import 'dotenv/config';
import Parser from 'rss-parser';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createClient as createLibsqlClient } from '@libsql/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, 'state.json');
const REPO_ROOT = path.resolve(__dirname, '../..');
const PUBLIC_IMAGES = path.join(REPO_ROOT, 'public', 'images');
const LOCAL_DB_PATH = path.join(REPO_ROOT, 'data', 'posts.db');

const argv = process.argv.slice(2);
const SEED_MODE = argv.includes('--seed');
const testFlagIdx = argv.indexOf('--test-telegram');
const TEST_TELEGRAM_FEED = testFlagIdx >= 0 ? argv[testFlagIdx + 1] : null;
const TEST_MODE = Boolean(TEST_TELEGRAM_FEED);
// --test-db replaces --test-contentful; the old flag stays as an alias so any saved
// muscle-memory commands keep working through the cutover.
const dbFlagIdx = argv.findIndex((a) => a === '--test-db' || a === '--test-contentful');
const TEST_DB_FEED = dbFlagIdx >= 0 ? argv[dbFlagIdx + 1] : null;
const TEST_DB_MODE = Boolean(TEST_DB_FEED);
const delSlugIdx = argv.indexOf('--delete-slug');
const DELETE_SLUG = delSlugIdx >= 0 ? argv[delSlugIdx + 1] : null;
const DELETE_MODE = Boolean(DELETE_SLUG);
const dryRunIdx = argv.indexOf('--dry-run');
const DRY_RUN_FEED = dryRunIdx >= 0 ? argv[dryRunIdx + 1] : null;
const DRY_RUN_MODE = Boolean(DRY_RUN_FEED);

const REQUIRED_ENV = SEED_MODE
  ? []
  : DRY_RUN_MODE
    ? ['GEMINI_API_KEY']
    : DELETE_MODE
      ? []
      : TEST_MODE
        ? ['GEMINI_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID_1', 'TELEGRAM_CHAT_ID_2']
        : TEST_DB_MODE
          ? ['GEMINI_API_KEY']
          : [
              'GEMINI_API_KEY',
              'TELEGRAM_BOT_TOKEN',
              'TELEGRAM_CHAT_ID_1',
              'TELEGRAM_CHAT_ID_2',
            ];
for (const k of REQUIRED_ENV) {
  if (!process.env[k]) {
    console.error(`Missing required env var: ${k}`);
    process.exit(1);
  }
}

const {
  GEMINI_API_KEY,
  GEMINI_MODEL = 'gemini-flash-latest',
  TURSO_DATABASE_URL,
  TURSO_AUTH_TOKEN,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID_1,
  TELEGRAM_THREAD_ID_1,
  TELEGRAM_CHAT_ID_2,
  TELEGRAM_BOT_TOKEN_2,
  TELEGRAM_CHAT_ID_3,
  TELEGRAM_THREAD_ID_3,
  RSS_URL = 'https://themicrodose.substack.com/feed',
  RSS_URLS,
} = process.env;

const db = createLibsqlClient({
  url: TURSO_DATABASE_URL ?? `file:${LOCAL_DB_PATH}`,
  authToken: TURSO_AUTH_TOKEN,
});

const FEED_URLS = (RSS_URLS || RSS_URL)
  .split(/[\s,]+/)
  .map((s) => s.trim())
  .filter(Boolean);

const DEFAULT_KEYWORDS = [
  'psychedelic', 'psychedelics', 'psychedelia',
  'psilocybin', 'psilocin', 'magic mushroom', 'magic mushrooms',
  'MDMA', 'ecstasy',
  'ayahuasca', 'DMT', '5-MeO-DMT', 'changa',
  'LSD',
  'ketamine', 'esketamine',
  'mescaline', 'peyote', 'huachuma', 'San Pedro',
  'ibogaine', 'iboga',
  'salvia', 'salvinorin',
  '2C-B',
  'hallucinogen', 'hallucinogens', 'hallucinogenic',
  'entheogen', 'entheogens', 'entheogenic',
  'microdose', 'microdosing',
];

const KEYWORDS = (process.env.KEYWORDS ?? DEFAULT_KEYWORDS.join(','))
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const KEYWORD_FILTER_OFF =
  process.env.KEYWORD_FILTER === 'off' || KEYWORDS.length === 0;

const KEYWORD_RE = KEYWORD_FILTER_OFF
  ? null
  : new RegExp(
      '\\b(' +
        KEYWORDS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') +
        ')\\b',
      'i',
    );

function matchKeyword(item) {
  if (!KEYWORD_RE) return null;
  const text = `${item.title || ''} ${item.contentSnippet || item.content || ''}`;
  const m = text.match(KEYWORD_RE);
  return m ? m[1] : null;
}

const log = (...args) => console.log(`[${new Date().toISOString()}]`, ...args);

// True only for the unflagged daily pipeline (not seed/test/delete runs), so the
// "quiet day" / failure notifications below never fire during manual test runs.
const IS_PRODUCTION_RUN =
  !SEED_MODE && !TEST_MODE && !TEST_DB_MODE && !DELETE_MODE && !DRY_RUN_MODE;

// Pop a macOS notification banner. Used to flag days the daily run posted nothing:
// Telegram already covers the days that DO post, so silence there = no signal. This
// fills that gap. Wrapped in try/catch so a notification failure never breaks the run.
function notifyMac(title, message) {
  try {
    execFileSync('osascript', [
      '-e',
      `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)}`,
    ]);
  } catch (e) {
    console.error(`  ⚠️ macOS notification failed: ${String(e.message).slice(0, 120)}`);
  }
}

async function loadState() {
  try {
    return JSON.parse(await fs.readFile(STATE_FILE, 'utf8'));
  } catch {
    return { seen: [] };
  }
}

async function saveState(state) {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Fetch the source article URL and extract main content + featured image
// using Mozilla Readability. Returns { content, ogImage } or null on failure.
async function extractArticle(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  let html = await res.text();

  // De-lazyload: many WordPress sites set src="data:image/..." placeholder and put
  // the real URL in data-src. Readability sees the placeholder otherwise.
  html = html.replace(
    /<img\b([^>]*?)\ssrc="data:image[^"]*"([^>]*?)\sdata-src="([^"]+)"([^>]*?)>/gi,
    '<img$1 src="$3"$2$4>',
  );
  html = html.replace(
    /<img\b([^>]*?)\sdata-src="([^"]+)"([^>]*?)\ssrc="data:image[^"]*"([^>]*?)>/gi,
    '<img$1 src="$2"$3$4>',
  );

  const og = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  const ogImage = og?.[1] || null;

  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document, { keepClasses: false });
  const article = reader.parse();
  if (!article || !article.content) return null;

  return { content: article.content, ogImage, articleTitle: article.title || '' };
}

function stripHtml(html) {
  return String(html)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/(p|div|li|h[1-6]|br|tr)>/gi, '\n')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function slugify(s) {
  const slug = String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return slug || `post-${Date.now()}`;
}

async function translate(title, content) {
  const prompt = `你是一位專業的繁體中文翻譯官。請將以下提供的資料翻譯成「繁體中文」，並嚴格遵守以下輸出規範：

1. 輸出格式必須是標準的 JSON。
2. 只要輸出 JSON 本身，禁止包含任何說明文字、Markdown 程式碼區塊標籤（如 \`\`\`json）、或任何額外評論。
3. 確保 JSON 內的特殊字元（如雙引號、反斜線、換行符）已正確轉義，避免格式錯誤。
4. 「content」欄位的 HTML 結構處理：
   - 如果輸入是 HTML，**完整保留**所有標籤（特別是 <img>、<a>、<p>、<h1>~<h6>、<ul>、<ol>、<li>、<blockquote>、<figure>、<figcaption>、<iframe>、<table> 等）。
   - 圖片標籤 <img src="..." alt="..."> 必須完整保留，src 屬性**絕不修改**（保持原始 URL），alt 屬性內的文字要翻譯。
   - 連結 <a href="..."> 的 href 不要翻譯，只翻譯顯示文字。
   - HTML 屬性名稱、CSS class、URL 一律不要翻譯。
   - 如果輸入是純文字，輸出也是純文字（不要硬加 HTML 標籤）。
5. 內容必須是「完整的一篇」：務必翻譯／濃縮到文章真正的結尾，最後一句話要完整，所有 HTML 標籤都要正確閉合，**嚴禁在句子或標籤中途停止**。若原文很長，請更積極地濃縮（總字數不含 HTML 標籤控制在 6000 字以內），寧可摘要得更精簡，也不要寫到一半就中斷。
6. 專有名詞翻譯對照（必須嚴格遵守）：
   - "psychedelic" / "psychedelics"（名詞，指物質）→ 啟靈藥
   - "psychedelic"（形容詞）→ 啟靈（例：psychedelic therapy → 啟靈療法；psychedelic experience → 啟靈體驗）
   - 不要翻譯成「迷幻藥」或「迷幻」。
待翻譯資料：
- 標題：${title}
- 內容：${content}

輸出格式範例（HTML 保留範例）：
{
  "title": "翻譯後的標題",
  "content": "<p>翻譯後的段落...</p><figure><img src=\\"https://example.com/photo.jpg\\" alt=\\"翻譯後的圖說\\" /><figcaption>翻譯後的圖片說明</figcaption></figure><p>更多內容...</p>"
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const requestOnce = async () => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // Force structured JSON: the API serializes the strings, so unescaped
        // quotes/newlines inside the translated HTML can no longer break parsing
        // (the old failure mode — see post-microdose.js translate JSON.parse crash).
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              content: { type: 'string' },
            },
            required: ['title', 'content'],
          },
          // HTML body can be long; raise the ceiling so the JSON isn't truncated
          // mid-string (which would still produce unparseable output).
          maxOutputTokens: 32768,
          temperature: 0.2,
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    }
    const json = await res.json();
    const candidate = json.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;
    log(`  ↳ Gemini finishReason=${candidate?.finishReason ?? '(none)'}, ${text?.length ?? 0} chars`);
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      // MAX_TOKENS / SAFETY / RECITATION → output is partial or empty; fail loud
      // rather than publishing half-translated HTML.
      throw new Error(`Gemini stopped early (finishReason=${candidate.finishReason})`);
    }
    if (!text) throw new Error(`Gemini returned no text: ${JSON.stringify(json).slice(0, 500)}`);
    return parseTranslation(text);
  };

  // Gemini occasionally stops mid-tag (finishReason still STOP) — see the Chacruna
  // dry-run that ended at `…target="_blank`. That renders as broken HTML, so retry a
  // few times and, only if every attempt is truncated, publish the longest one with
  // the dangling tag trimmed off rather than failing the whole item.
  const MAX_ATTEMPTS = 2;
  let best = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await requestOnce();
    if (!looksTruncated(result.content)) return result;
    log(`  ⚠️ translation ends mid-tag (attempt ${attempt}/${MAX_ATTEMPTS}) — retrying`);
    if (!best || result.content.length > best.content.length) best = result;
  }
  best.content = trimDanglingTag(best.content);
  log('  ⚠️ still truncated after retries — trimmed dangling tag, publishing best effort');
  return best;
}

// True when the HTML ends with an unterminated tag (a "<" + tag name with no closing
// ">" before end-of-string) — the signature of a mid-tag Gemini truncation.
function looksTruncated(html) {
  return /<[a-zA-Z][^>]*$/.test(String(html).trimEnd());
}

// Drop a trailing unterminated tag fragment so we never publish broken markup.
function trimDanglingTag(html) {
  return String(html).replace(/<[a-zA-Z][^>]*$/, '').trimEnd();
}

// Parse Gemini's translation payload into { title, content }. With responseMimeType
// = application/json the text is already valid JSON, but we stay defensive: strip any
// stray code fences, validate the shape, and throw a descriptive error (with a snippet)
// instead of letting a raw JSON.parse SyntaxError bubble up as a fatal crash.
function parseTranslation(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  let obj;
  try {
    obj = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(
      `Gemini JSON parse failed (${String(e.message).slice(0, 80)}); head: ${cleaned.slice(0, 160)}`,
    );
  }
  if (!obj || typeof obj.title !== 'string' || typeof obj.content !== 'string') {
    throw new Error(`Gemini JSON missing title/content: ${cleaned.slice(0, 160)}`);
  }
  return obj;
}

// Mimic Contentful's 22-char base62-ish asset IDs so existing /images/<id>/<file>
// path conventions stay consistent across pre-migration and post-migration data.
function makeAssetId() {
  return crypto.randomBytes(16).toString('base64url').slice(0, 22);
}

function sanitiseFileName(name) {
  // Contentful CLI replaces spaces/parens/commas/quotes with _ when downloading
  // assets — mirror that so featured paths look uniform with the migrated data.
  return name.replace(/[ ()',!@#$&*+={}[\]]/g, '_').slice(0, 120);
}

// Download featuredImageUrl to public/images/<assetId>/<filename>. Returns
// { assetId, publicPath, destPath } so a failed Sqlite write can clean up.
async function downloadImageToPublic({ imageUrl }) {
  const rawName = (imageUrl.split('/').pop() || 'featured.jpg').split('?')[0].slice(0, 80) || 'featured.jpg';
  const fileName = sanitiseFileName(rawName);
  const assetId = makeAssetId();
  const destDir = path.join(PUBLIC_IMAGES, assetId);
  const destPath = path.join(destDir, fileName);

  const res = await fetch(imageUrl, {
    headers: { 'User-Agent': BROWSER_UA, Accept: 'image/*' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`image fetch ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  await fs.mkdir(destDir, { recursive: true });
  await fs.writeFile(destPath, buf);

  return {
    assetId,
    destPath,
    publicPath: `/images/${assetId}/${fileName}`,
  };
}

async function removeLocalImage(destPath) {
  try {
    await fs.unlink(destPath);
    const dir = path.dirname(destPath);
    try { await fs.rmdir(dir); } catch { /* dir has other files — leave it */ }
    log(`  ↳ rolled back orphan image at ${path.relative(REPO_ROOT, destPath)}`);
  } catch {
    /* best-effort cleanup */
  }
}

// Apply the same 迷幻 → 啟靈 transform the migration script applied to historical
// posts, so new RSS posts stay consistent (Gemini prompt asks for it but isn't
// 100% reliable). Log per-post counts so we can spot Gemini regressions.
function applyPsychedelicRewrite(text, label) {
  if (!text || !text.includes('迷幻')) return text;
  const count = (text.match(/迷幻/g) || []).length;
  log(`  ↳ rewrote 迷幻→啟靈 ${count}× in ${label}`);
  return text.replaceAll('迷幻', '啟靈');
}

async function deletePostBySlug(slug) {
  const find = await db.execute({
    sql: 'SELECT id, title, featured_image_path FROM posts WHERE slug = ?',
    args: [slug],
  });
  if (find.rows.length === 0) {
    log(`No post with slug "${slug}" found.`);
    return 0;
  }
  let deletedCount = 0;
  for (const row of find.rows) {
    const id = row.id;
    const title = row.title;
    const imgPath = row.featured_image_path;
    log(`Deleting post #${id} — "${title}"`);
    // post_stats has ON DELETE CASCADE, so a single DELETE clears both rows.
    await db.execute({ sql: 'DELETE FROM posts WHERE id = ?', args: [id] });
    deletedCount++;

    if (imgPath && imgPath.startsWith('/images/')) {
      const abs = path.join(REPO_ROOT, 'public', imgPath.replace(/^\//, ''));
      await removeLocalImage(abs);
    }
  }
  return deletedCount;
}

// Slugs must be UNIQUE in SQLite. If a future article shares a slug with an existing
// one, append the publish timestamp so the INSERT succeeds rather than crashing the
// daily run.
async function uniqueSlug(slug) {
  const existing = await db.execute({
    sql: 'SELECT 1 FROM posts WHERE slug = ? LIMIT 1',
    args: [slug],
  });
  if (existing.rows.length === 0) return slug;
  const suffix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${slug}-${suffix}`;
}

async function publishToSqlite({ title, content, sourceUrl, slug, featuredImageUrl, publishedAt }) {
  let imageDownload = null;
  if (featuredImageUrl) {
    try {
      imageDownload = await downloadImageToPublic({ imageUrl: featuredImageUrl });
      log(`  ↳ featured image saved to ${imageDownload.publicPath}`);
    } catch (e) {
      log(`  ⚠️ featured image download failed: ${String(e.message).slice(0, 120)} (publishing without it)`);
    }
  }

  const finalSlug = await uniqueSlug(slug);
  if (finalSlug !== slug) log(`  ↳ slug "${slug}" taken — using "${finalSlug}"`);

  try {
    const insertedPost = await db.execute({
      sql: `INSERT INTO posts
              (slug, title, subtitle, author_id, published_at, featured_image_path, source_url, body_html, origin, contentful_id)
            VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, 'rss', NULL)`,
      args: [
        finalSlug,
        title,
        publishedAt,
        imageDownload?.publicPath ?? null,
        sourceUrl,
        content,
      ],
    });
    const postId = Number(insertedPost.lastInsertRowid);
    await db.execute({ sql: 'INSERT INTO post_stats (post_id) VALUES (?)', args: [postId] });
    return { postId, slug: finalSlug };
  } catch (e) {
    if (imageDownload) await removeLocalImage(imageDownload.destPath);
    throw e;
  }
}

function formatTelegram(title, content, link) {
  const limit = 3800;
  let body = content;
  if (body.length > limit) body = body.slice(0, limit) + '\n\n...(內容過長已截斷)';
  return `<b>📰 <a href="${escapeHtml(link)}">${escapeHtml(title)}</a></b>\n\n<blockquote expandable>${escapeHtml(body)}</blockquote>`;
}

async function sendTelegram(botToken, chatId, threadId, html, link) {
  const text = `${html}\n${link}`;
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: false,
  };
  if (threadId) body.message_thread_id = Number(threadId);
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // Don't abort the run on Telegram failure — the SQLite row is already in.
    console.error(`Telegram ${chatId} error: ${res.status} ${await res.text()}`);
  }
}

async function broadcast(html, link) {
  await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID_1, TELEGRAM_THREAD_ID_1, html, link);
  await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID_2, null, html, link);
  if (TELEGRAM_BOT_TOKEN_2 && TELEGRAM_CHAT_ID_3) {
    await sendTelegram(TELEGRAM_BOT_TOKEN_2, TELEGRAM_CHAT_ID_3, TELEGRAM_THREAD_ID_3, html, link);
  }
}

async function main() {
  const parser = new Parser({
    timeout: 20000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'application/rss+xml, application/xml, text/xml, */*',
    },
    customFields: {
      item: [
        ['content:encoded', 'contentEncoded'],
        ['media:content', 'mediaContent'],
        ['media:thumbnail', 'mediaThumbnail'],
      ],
    },
  });

  // Prefer full article via Readability (gives us images + featured image URL).
  // Fall back to RSS-provided HTML if the fetch/extract fails.
  const extractContentFor = async (item) => {
    if (item.link) {
      try {
        const ext = await extractArticle(item.link);
        if (ext && ext.content && ext.content.length > 200) {
          log(`  ↳ extracted ${ext.content.length} chars from ${item.link}${ext.ogImage ? ' (og:image found)' : ''}`);
          return { html: ext.content, featuredImageUrl: ext.ogImage };
        }
        log(`  ↳ extraction returned little/nothing, falling back to RSS`);
      } catch (e) {
        log(`  ↳ extraction failed (${String(e.message).slice(0, 80)}), falling back to RSS`);
      }
    }
    const fallbackHtml =
      item.contentEncoded || item.content || item.summary || item.contentSnippet || '';
    // RSS sometimes has the featured image in <enclosure> or <media:content>
    const enclosureUrl =
      item.enclosure?.url ||
      item.mediaContent?.['$']?.url ||
      item.mediaThumbnail?.['$']?.url ||
      null;
    return { html: fallbackHtml, featuredImageUrl: enclosureUrl };
  };

  if (DELETE_MODE) {
    log(`DELETE MODE — slug: "${DELETE_SLUG}"`);
    const n = await deletePostBySlug(DELETE_SLUG);
    log(`✅ Done. ${n} post${n === 1 ? '' : 's'} deleted.`);
    return;
  }

  if (DRY_RUN_MODE) {
    log(`DRY RUN — feed: ${DRY_RUN_FEED}`);
    log('Translates the latest item and prints the preview. No DB write, no Telegram, no state save.');
    const feed = await parser.parseURL(DRY_RUN_FEED);
    const item = feed.items?.[0];
    if (!item) throw new Error('Feed has no items.');
    log(`Latest item: "${item.title}"`);
    const { html: srcHtml, featuredImageUrl } = await extractContentFor(item);
    const translated = await translate(item.title, srcHtml);
    translated.title = applyPsychedelicRewrite(translated.title, 'title');
    translated.content = applyPsychedelicRewrite(translated.content, 'body');
    const slug = slugify(item.title);
    const tgText = stripHtml(translated.content);
    const sep = '─'.repeat(60);
    console.log(`\n${sep}\nDRY-RUN PREVIEW (nothing was published or sent)\n${sep}`);
    console.log(`Title          : ${translated.title}`);
    console.log(`Slug           : ${slug}`);
    console.log(`Source URL     : ${item.link}`);
    console.log(`Featured image : ${featuredImageUrl || '(none)'}`);
    console.log(`Site URL       : /${slug}`);
    console.log(`\n${sep}\nBODY HTML (posts.body_html)\n${sep}\n${translated.content}`);
    console.log(`\n${sep}\nTELEGRAM PLAIN TEXT\n${sep}\n${tgText}`);
    console.log(`\n${sep}`);
    return;
  }

  if (TEST_MODE) {
    log(`TEST MODE — feed: ${TEST_TELEGRAM_FEED}`);
    log('Will broadcast latest item to all configured Telegram chats. No DB write, no state save.');
    const feed = await parser.parseURL(TEST_TELEGRAM_FEED);
    const item = feed.items?.[0];
    if (!item) throw new Error('Feed has no items.');
    log(`Latest item: "${item.title}"`);
    const { html: srcHtml } = await extractContentFor(item);
    const translated = await translate(item.title, srcHtml);
    translated.title = applyPsychedelicRewrite(translated.title, 'title');
    translated.content = applyPsychedelicRewrite(translated.content, 'body');
    const tgText = stripHtml(translated.content);
    const tgHtml = formatTelegram(translated.title, tgText, item.link);
    await broadcast(tgHtml, item.link);
    log(
      `✅ Test message sent to chat_1 (${TELEGRAM_CHAT_ID_1}), chat_2 (${TELEGRAM_CHAT_ID_2})` +
        (TELEGRAM_BOT_TOKEN_2 && TELEGRAM_CHAT_ID_3
          ? `, chat_3 (${TELEGRAM_CHAT_ID_3})`
          : '') +
        '. Check Telegram.',
    );
    return;
  }

  if (TEST_DB_MODE) {
    log(`TEST DB MODE — feed: ${TEST_DB_FEED}`);
    log('Will create ONE post in SQLite. No Telegram, no state save.');
    const feed = await parser.parseURL(TEST_DB_FEED);
    const item = feed.items?.[0];
    if (!item) throw new Error('Feed has no items.');
    log(`Latest item: "${item.title}"`);
    const { html: srcHtml, featuredImageUrl } = await extractContentFor(item);
    const translated = await translate(item.title, srcHtml);
    translated.title = applyPsychedelicRewrite(translated.title, 'title');
    translated.content = applyPsychedelicRewrite(translated.content, 'body');
    const slug = slugify(item.title);
    const publishedAt = new Date(item.isoDate || item.pubDate || Date.now()).toISOString();
    const { postId, slug: finalSlug } = await publishToSqlite({
      title: translated.title,
      content: translated.content,
      sourceUrl: item.link,
      slug,
      featuredImageUrl,
      publishedAt,
    });
    log(`✅ Post inserted into SQLite.`);
    log(`   Post ID  : ${postId}`);
    log(`   Slug     : ${finalSlug}`);
    log(`   Title    : ${translated.title}`);
    log(`   Source   : ${item.link}`);
    log(`   Site URL : /${finalSlug}  (visible after next ISR regeneration)`);
    return;
  }

  if (SEED_MODE) {
    log(`SEED MODE — marking all current items as seen across ${FEED_URLS.length} feed(s).`);
    log('No translation, no DB writes, no Telegram messages.');
    const state = await loadState();
    const seen = new Set(state.seen);
    const before = seen.size;
    let totalItems = 0;
    for (const feedUrl of FEED_URLS) {
      try {
        const feed = await parser.parseURL(feedUrl);
        const count = feed.items?.length || 0;
        totalItems += count;
        for (const item of feed.items || []) {
          const id = item.guid || item.link;
          if (id) seen.add(id);
        }
        log(`  ${feedUrl} — ${count} items`);
      } catch (e) {
        console.error(`  ⚠️ ${feedUrl} failed: ${String(e.message).slice(0, 120)}`);
      }
    }
    await saveState({ seen: Array.from(seen).slice(-2000) });
    log(`✅ Seeded. ${seen.size - before} new ID(s) added (was ${before}, now ${seen.size}). Scanned ${totalItems} items across ${FEED_URLS.length} feed(s).`);
    log('Future runs will only process items published from now on.');
    return;
  }

  const state = await loadState();
  const seen = new Set(state.seen);

  log(`Polling ${FEED_URLS.length} feed(s).`);

  const allItems = [];
  for (const feedUrl of FEED_URLS) {
    try {
      const feed = await parser.parseURL(feedUrl);
      for (const item of feed.items || []) {
        allItems.push({ ...item, _feedUrl: feedUrl, _feedTitle: feed.title });
      }
    } catch (e) {
      console.error(`  ⚠️ ${feedUrl} failed: ${String(e.message).slice(0, 120)}`);
    }
  }

  // Filter unseen, then sort oldest first so a catch-up run posts in chronological order.
  const newItems = allItems
    .filter((item) => !seen.has(item.guid || item.link))
    .sort((a, b) => {
      const da = new Date(a.isoDate || a.pubDate || 0).getTime();
      const db = new Date(b.isoDate || b.pubDate || 0).getTime();
      return da - db;
    });

  if (newItems.length === 0) {
    log('No new items.');
    notifyMac('🍄 Microdose daily', `今天沒有新文章（掃了 ${FEED_URLS.length} 個 feed，0 篇發佈）`);
    return;
  }

  log(`${newItems.length} new item(s) to evaluate.`);
  if (KEYWORD_RE) log(`Keyword filter active: ${KEYWORDS.length} terms.`);

  let publishedCount = 0;
  let failedCount = 0;
  for (const item of newItems) {
    const id = item.guid || item.link;

    const matched = matchKeyword(item);
    if (KEYWORD_RE && !matched) {
      log(`  ⊘ skip (no keyword) [${item._feedTitle}]: ${item.title}`);
      seen.add(id);
      await saveState({ seen: Array.from(seen).slice(-2000) });
      continue;
    }

    log(
      `Processing [${item._feedTitle}]${matched ? ` (matched "${matched}")` : ''}: ${item.title}`,
    );

    // Isolate each item: one failure (e.g. a bad Gemini response) must not abort
    // the whole batch and strand the items queued behind it. On error we log +
    // notify but deliberately DON'T mark the item seen, so the next run retries it.
    try {
      const { html: srcHtml, featuredImageUrl } = await extractContentFor(item);
      const translated = await translate(item.title, srcHtml);
      translated.title = applyPsychedelicRewrite(translated.title, 'title');
      translated.content = applyPsychedelicRewrite(translated.content, 'body');
      const slug = slugify(item.title);
      const publishedAt = new Date(item.isoDate || item.pubDate || Date.now()).toISOString();

      const { slug: finalSlug } = await publishToSqlite({
        title: translated.title,
        content: translated.content,
        sourceUrl: item.link,
        slug,
        featuredImageUrl,
        publishedAt,
      });
      log(`  SQLite: published "${finalSlug}"`);

      const tgText = stripHtml(translated.content);
      const tgHtml = formatTelegram(translated.title, tgText, item.link);
      await broadcast(tgHtml, item.link);
      log(`  Telegram: sent`);

      seen.add(id);
      await saveState({ seen: Array.from(seen).slice(-2000) });
      publishedCount++;
      log(`  ✅ Done`);
    } catch (e) {
      failedCount++;
      log(`  ❌ Failed (will retry next run): ${String(e.message).slice(0, 200)}`);
    }
  }

  if (publishedCount === 0 && failedCount === 0) {
    notifyMac(
      '🍄 Microdose daily',
      `今天有 ${newItems.length} 篇新項目，但全被關鍵字過濾，0 篇發佈`,
    );
  }
  if (failedCount > 0) {
    notifyMac(
      '🍄 Microdose daily ⚠️',
      `今天發佈 ${publishedCount} 篇，但有 ${failedCount} 篇失敗（已記錄，明天重試）`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal:', err);
    if (IS_PRODUCTION_RUN) {
      notifyMac(
        '🍄 Microdose daily ⚠️',
        `今天執行失敗：${String(err?.message || err).slice(0, 150)}`,
      );
    }
    process.exit(1);
  });
