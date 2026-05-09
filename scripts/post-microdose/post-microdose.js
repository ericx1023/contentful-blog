import 'dotenv/config';
import Parser from 'rss-parser';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, 'state.json');

const argv = process.argv.slice(2);
const SEED_MODE = argv.includes('--seed');
const testFlagIdx = argv.indexOf('--test-telegram');
const TEST_TELEGRAM_FEED = testFlagIdx >= 0 ? argv[testFlagIdx + 1] : null;
const TEST_MODE = Boolean(TEST_TELEGRAM_FEED);
const cfFlagIdx = argv.indexOf('--test-contentful');
const TEST_CONTENTFUL_FEED = cfFlagIdx >= 0 ? argv[cfFlagIdx + 1] : null;
const TEST_CONTENTFUL_MODE = Boolean(TEST_CONTENTFUL_FEED);
const delSlugIdx = argv.indexOf('--delete-slug');
const DELETE_SLUG = delSlugIdx >= 0 ? argv[delSlugIdx + 1] : null;
const DELETE_MODE = Boolean(DELETE_SLUG);

const REQUIRED_ENV = SEED_MODE
  ? []
  : DELETE_MODE
    ? ['CONTENTFUL_SPACE_ID', 'CONTENTFUL_CMA_TOKEN']
    : TEST_MODE
      ? ['GEMINI_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID_1', 'TELEGRAM_CHAT_ID_2']
      : TEST_CONTENTFUL_MODE
        ? ['GEMINI_API_KEY', 'CONTENTFUL_SPACE_ID', 'CONTENTFUL_CMA_TOKEN']
        : [
            'GEMINI_API_KEY',
            'CONTENTFUL_SPACE_ID',
            'CONTENTFUL_CMA_TOKEN',
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
  CONTENTFUL_SPACE_ID,
  CONTENTFUL_CMA_TOKEN,
  CONTENTFUL_ENV = 'master',
  CONTENTFUL_TYPE = 'pageBlogPostWithHtml',
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
5. 如果翻譯內容過長，請濃縮摘要，總字數（不含 HTML 標籤）盡量不超過 8000 字。
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
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini returned no text: ${JSON.stringify(json)}`);
  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

async function uploadAsset({ imageUrl, title, base, auth, locale }) {
  const fileName = (imageUrl.split('/').pop() || 'featured.jpg').split('?')[0].slice(0, 80);
  const ext = (fileName.match(/\.(\w+)$/)?.[1] || 'jpg').toLowerCase();
  const contentType =
    { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }[ext] ||
    'image/jpeg';

  const createRes = await fetch(`${base}/assets`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      fields: {
        title: { [locale]: title.slice(0, 200) },
        file: { [locale]: { contentType, fileName, upload: imageUrl } },
      },
    }),
  });
  if (!createRes.ok) throw new Error(`asset create ${createRes.status}: ${await createRes.text()}`);
  const asset = await createRes.json();

  const procRes = await fetch(`${base}/assets/${asset.sys.id}/files/${locale}/process`, {
    method: 'PUT',
    headers: { ...auth, 'X-Contentful-Version': String(asset.sys.version) },
  });
  if (!procRes.ok) throw new Error(`asset process ${procRes.status}: ${await procRes.text()}`);

  // Poll until Contentful has fetched + processed the file.
  let processed = null;
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 800));
    const getRes = await fetch(`${base}/assets/${asset.sys.id}`, {
      headers: { Authorization: auth.Authorization },
    });
    const a = await getRes.json();
    if (a.fields?.file?.[locale]?.url) {
      processed = a;
      break;
    }
  }
  if (!processed) throw new Error('asset processing timed out after 20s');

  const pubRes = await fetch(`${base}/assets/${processed.sys.id}/published`, {
    method: 'PUT',
    headers: { ...auth, 'X-Contentful-Version': String(processed.sys.version) },
  });
  if (!pubRes.ok) throw new Error(`asset publish ${pubRes.status}: ${await pubRes.text()}`);
  return processed.sys.id;
}

async function deleteEntryBySlug(slug) {
  const base = `https://api.contentful.com/spaces/${CONTENTFUL_SPACE_ID}/environments/${CONTENTFUL_ENV}`;
  const auth = {
    Authorization: `Bearer ${CONTENTFUL_CMA_TOKEN}`,
    'Content-Type': 'application/vnd.contentful.management.v1+json',
  };
  const locale = process.env.CONTENTFUL_LOCALE || 'zh-Hant-TW';

  const findUrl =
    `${base}/entries?content_type=${encodeURIComponent(CONTENTFUL_TYPE)}` +
    `&fields.slug.${locale}=${encodeURIComponent(slug)}`;
  const findRes = await fetch(findUrl, { headers: { Authorization: auth.Authorization } });
  if (!findRes.ok) {
    throw new Error(`find ${findRes.status}: ${await findRes.text()}`);
  }
  const found = await findRes.json();
  if (!found.items || found.items.length === 0) {
    log(`No entry with slug "${slug}" found.`);
    return 0;
  }

  let deletedCount = 0;
  for (const entry of found.items) {
    const entryId = entry.sys.id;
    const title = entry.fields.title?.[locale] || '(no title)';
    const assetId = entry.fields.featuredImage?.[locale]?.sys?.id || null;
    log(`Deleting entry ${entryId} — "${title}"`);

    if (entry.sys.publishedVersion) {
      const r = await fetch(`${base}/entries/${entryId}/published`, {
        method: 'DELETE',
        headers: auth,
      });
      if (r.ok) log(`  ↳ unpublished`);
      else log(`  ⚠️ unpublish ${r.status}: ${(await r.text()).slice(0, 120)}`);
    }
    const dr = await fetch(`${base}/entries/${entryId}`, { method: 'DELETE', headers: auth });
    if (!dr.ok) {
      log(`  ⚠️ delete ${dr.status}: ${(await dr.text()).slice(0, 120)}`);
      continue;
    }
    log(`  ↳ entry deleted`);
    deletedCount++;

    if (assetId) {
      try {
        const ar = await fetch(`${base}/assets/${assetId}`, {
          headers: { Authorization: auth.Authorization },
        });
        if (ar.ok) {
          const asset = await ar.json();
          if (asset.sys.publishedVersion) {
            await fetch(`${base}/assets/${assetId}/published`, {
              method: 'DELETE',
              headers: auth,
            });
          }
          const ad = await fetch(`${base}/assets/${assetId}`, {
            method: 'DELETE',
            headers: auth,
          });
          if (ad.ok) log(`  ↳ associated asset ${assetId} deleted`);
          else log(`  ⚠️ asset delete ${ad.status}`);
        }
      } catch (e) {
        log(`  ⚠️ asset cleanup failed: ${String(e.message).slice(0, 80)}`);
      }
    }
  }
  return deletedCount;
}

async function rollbackAsset(assetId, base, auth) {
  try {
    const r = await fetch(`${base}/assets/${assetId}`, {
      headers: { Authorization: auth.Authorization },
    });
    if (!r.ok) return;
    const a = await r.json();
    if (a.sys.publishedVersion) {
      await fetch(`${base}/assets/${assetId}/published`, { method: 'DELETE', headers: auth });
    }
    await fetch(`${base}/assets/${assetId}`, { method: 'DELETE', headers: auth });
    log(`  ↳ rolled back orphan asset ${assetId}`);
  } catch {
    /* best-effort cleanup */
  }
}

async function publishToContentful({ title, content, sourceUrl, slug, featuredImageUrl }) {
  const base = `https://api.contentful.com/spaces/${CONTENTFUL_SPACE_ID}/environments/${CONTENTFUL_ENV}`;
  const auth = {
    Authorization: `Bearer ${CONTENTFUL_CMA_TOKEN}`,
    'Content-Type': 'application/vnd.contentful.management.v1+json',
  };
  const locale = process.env.CONTENTFUL_LOCALE || 'zh-Hant-TW';

  let assetId = null;
  if (featuredImageUrl) {
    try {
      assetId = await uploadAsset({ imageUrl: featuredImageUrl, title, base, auth, locale });
      log(`  ↳ featured image uploaded as asset ${assetId}`);
    } catch (e) {
      log(`  ⚠️ featured image upload failed: ${String(e.message).slice(0, 120)} (entry will publish without it)`);
    }
  }

  const fields = {
    internalName: { [locale]: title },
    slug:         { [locale]: slug },
    title:        { [locale]: title },
    html:         { [locale]: content },
    sourceUrl:    { [locale]: sourceUrl },
  };
  if (assetId) {
    fields.featuredImage = {
      [locale]: { sys: { type: 'Link', linkType: 'Asset', id: assetId } },
    };
  }

  const createRes = await fetch(`${base}/entries`, {
    method: 'POST',
    headers: { ...auth, 'X-Contentful-Content-Type': CONTENTFUL_TYPE },
    body: JSON.stringify({ fields }),
  });
  if (!createRes.ok) {
    if (assetId) await rollbackAsset(assetId, base, auth);
    throw new Error(`Contentful create ${createRes.status}: ${await createRes.text()}`);
  }
  const entry = await createRes.json();

  const pubRes = await fetch(`${base}/entries/${entry.sys.id}/published`, {
    method: 'PUT',
    headers: { ...auth, 'X-Contentful-Version': String(entry.sys.version) },
  });
  if (!pubRes.ok) {
    // Roll back orphan draft + uploaded asset so retries don't accumulate junk.
    await fetch(`${base}/entries/${entry.sys.id}`, {
      method: 'DELETE',
      headers: { ...auth, 'X-Contentful-Version': String(entry.sys.version) },
    }).catch(() => {});
    if (assetId) await rollbackAsset(assetId, base, auth);
    throw new Error(`Contentful publish ${pubRes.status}: ${await pubRes.text()}`);
  }
  return entry.sys.id;
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
    // Don't abort the run on Telegram failure — Contentful already published.
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
    const n = await deleteEntryBySlug(DELETE_SLUG);
    log(`✅ Done. ${n} entr${n === 1 ? 'y' : 'ies'} deleted.`);
    return;
  }

  if (TEST_MODE) {
    log(`TEST MODE — feed: ${TEST_TELEGRAM_FEED}`);
    log('Will broadcast latest item to all configured Telegram chats. No Contentful, no state save.');
    const feed = await parser.parseURL(TEST_TELEGRAM_FEED);
    const item = feed.items?.[0];
    if (!item) throw new Error('Feed has no items.');
    log(`Latest item: "${item.title}"`);
    const { html: srcHtml } = await extractContentFor(item);
    const translated = await translate(item.title, srcHtml);
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

  if (TEST_CONTENTFUL_MODE) {
    log(`TEST CONTENTFUL MODE — feed: ${TEST_CONTENTFUL_FEED}`);
    log('Will create + publish ONE Contentful entry. No Telegram, no state save.');
    const feed = await parser.parseURL(TEST_CONTENTFUL_FEED);
    const item = feed.items?.[0];
    if (!item) throw new Error('Feed has no items.');
    log(`Latest item: "${item.title}"`);
    const { html: srcHtml, featuredImageUrl } = await extractContentFor(item);
    const translated = await translate(item.title, srcHtml);
    const slug = slugify(item.title);
    const entryId = await publishToContentful({
      title: translated.title,
      content: translated.content,
      sourceUrl: item.link,
      slug,
      featuredImageUrl,
    });
    log(`✅ Contentful entry created and published.`);
    log(`   Entry ID : ${entryId}`);
    log(`   Slug     : ${slug}`);
    log(`   Title    : ${translated.title}`);
    log(`   Source   : ${item.link}`);
    log(`   Site URL : /html-posts/${slug}  (visible after next ISR regeneration)`);
    return;
  }

  if (SEED_MODE) {
    log(`SEED MODE — marking all current items as seen across ${FEED_URLS.length} feed(s).`);
    log('No translation, no Contentful entries, no Telegram messages.');
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
    return;
  }

  log(`${newItems.length} new item(s) to evaluate.`);
  if (KEYWORD_RE) log(`Keyword filter active: ${KEYWORDS.length} terms.`);

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

    const { html: srcHtml, featuredImageUrl } = await extractContentFor(item);
    const translated = await translate(item.title, srcHtml);
    const slug = slugify(item.title);

    await publishToContentful({
      title: translated.title,
      content: translated.content,
      sourceUrl: item.link,
      slug,
      featuredImageUrl,
    });
    log(`  Contentful: published "${slug}"`);

    const tgText = stripHtml(translated.content);
    const tgHtml = formatTelegram(translated.title, tgText, item.link);
    await broadcast(tgHtml, item.link);
    log(`  Telegram: sent`);

    seen.add(id);
    await saveState({ seen: Array.from(seen).slice(-2000) });
    log(`  ✅ Done`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });
