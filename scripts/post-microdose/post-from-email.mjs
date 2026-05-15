// One-off helper for the "scan email → generate post" flow.
// Two-stage operation:
//   1) Dry-run (default):  node post-from-email.mjs <url>
//      Fetches the article via Readability, translates with Gemini,
//      prints a Contentful HTML + Telegram text preview, and caches
//      the result to /tmp/post-from-email-cache.json.
//   2) Ship:                node post-from-email.mjs --ship
//      Reads the cached preview, uploads the og:image asset,
//      creates+publishes the Contentful entry, broadcasts to Telegram.
//      Does NOT touch state.json (this content didn't come from RSS).
//
// Functions for extractArticle/translate/stripHtml/escapeHtml/slugify/
// formatTelegram/uploadAsset/publishToContentful/sendTelegram are
// duplicated here on purpose so that this script can evolve
// independently of the production pipeline and editing one does
// not risk breaking the daily run.

import 'dotenv/config';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const CACHE_FILE = path.join(os.tmpdir(), 'post-from-email-cache.json');

const argv = process.argv.slice(2);
const SHIP = argv.includes('--ship');
const URL_ARG = argv.find((a) => /^https?:\/\//.test(a));

const {
  GEMINI_API_KEY,
  GEMINI_MODEL = 'gemini-flash-latest',
  CONTENTFUL_SPACE_ID,
  CONTENTFUL_CMA_TOKEN,
  CONTENTFUL_ENV = 'master',
  CONTENTFUL_TYPE = 'pageBlogPostWithHtml',
  CONTENTFUL_LOCALE = 'zh-Hant-TW',
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID_1,
  TELEGRAM_THREAD_ID_1,
  TELEGRAM_CHAT_ID_2,
  TELEGRAM_BOT_TOKEN_2,
  TELEGRAM_CHAT_ID_3,
  TELEGRAM_THREAD_ID_3,
} = process.env;

const log = (...a) => console.log(`[${new Date().toISOString()}]`, ...a);

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function slugify(s) {
  const slug = String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return slug || `post-${Date.now()}`;
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

async function extractArticle(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  let html = await res.text();

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
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
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

async function rollbackAsset({ assetId, base, auth }) {
  try {
    const getRes = await fetch(`${base}/assets/${assetId}`, { headers: { Authorization: auth.Authorization } });
    const a = await getRes.json();
    if (a.sys?.publishedVersion) {
      await fetch(`${base}/assets/${assetId}/published`, {
        method: 'DELETE',
        headers: { ...auth, 'X-Contentful-Version': String(a.sys.version) },
      });
    }
    await fetch(`${base}/assets/${assetId}`, {
      method: 'DELETE',
      headers: { ...auth, 'X-Contentful-Version': String(a.sys.version + 1) },
    });
    log(`  ↳ rolled back asset ${assetId}`);
  } catch (e) {
    log(`  ↳ asset rollback failed: ${String(e.message).slice(0, 120)}`);
  }
}

async function publishToContentful({ title, content, sourceUrl, slug, featuredImageUrl }) {
  const base = `https://api.contentful.com/spaces/${CONTENTFUL_SPACE_ID}/environments/${CONTENTFUL_ENV}`;
  const auth = {
    Authorization: `Bearer ${CONTENTFUL_CMA_TOKEN}`,
    'Content-Type': 'application/vnd.contentful.management.v1+json',
    'X-Contentful-Content-Type': CONTENTFUL_TYPE,
  };
  const locale = CONTENTFUL_LOCALE;

  let featuredImageId = null;
  if (featuredImageUrl) {
    try {
      featuredImageId = await uploadAsset({ imageUrl: featuredImageUrl, title, base, auth, locale });
      log(`  ↳ featured image uploaded as asset ${featuredImageId}`);
    } catch (e) {
      log(`  ↳ featured image upload failed (continuing without): ${String(e.message).slice(0, 120)}`);
    }
  }

  const fields = {
    internalName: { [locale]: title.slice(0, 100) },
    title: { [locale]: title },
    slug: { [locale]: slug },
    htmlContent: { [locale]: content },
    publishedDate: { [locale]: new Date().toISOString() },
    sourceUrl: { [locale]: sourceUrl },
  };
  if (featuredImageId) {
    fields.featuredImage = { [locale]: { sys: { type: 'Link', linkType: 'Asset', id: featuredImageId } } };
  }

  const createRes = await fetch(`${base}/entries`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ fields }),
  });
  if (!createRes.ok) {
    const t = await createRes.text();
    if (featuredImageId) await rollbackAsset({ assetId: featuredImageId, base, auth });
    throw new Error(`entry create ${createRes.status}: ${t}`);
  }
  const entry = await createRes.json();

  const pubRes = await fetch(`${base}/entries/${entry.sys.id}/published`, {
    method: 'PUT',
    headers: { ...auth, 'X-Contentful-Version': String(entry.sys.version) },
  });
  if (!pubRes.ok) {
    const t = await pubRes.text();
    if (featuredImageId) await rollbackAsset({ assetId: featuredImageId, base, auth });
    throw new Error(`entry publish ${pubRes.status}: ${t}`);
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
  const body = { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: false };
  if (threadId) body.message_thread_id = Number(threadId);
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error(`Telegram ${chatId} error: ${res.status} ${await res.text()}`);
}

async function broadcast(html, link) {
  await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID_1, TELEGRAM_THREAD_ID_1, html, link);
  await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID_2, null, html, link);
  if (TELEGRAM_BOT_TOKEN_2 && TELEGRAM_CHAT_ID_3) {
    await sendTelegram(TELEGRAM_BOT_TOKEN_2, TELEGRAM_CHAT_ID_3, TELEGRAM_THREAD_ID_3, html, link);
  }
}

async function dryRun(url) {
  if (!GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY');
  log(`DRY-RUN — extracting ${url}`);
  const ext = await extractArticle(url);
  if (!ext || !ext.content) throw new Error('Readability extraction returned nothing');
  log(`  ↳ extracted ${ext.content.length} chars${ext.ogImage ? ' (og:image found)' : ''}`);

  const srcTitle = ext.articleTitle || '(no title)';
  log(`  ↳ source title: ${srcTitle}`);
  log(`Translating via ${GEMINI_MODEL}...`);
  const translated = await translate(srcTitle, ext.content);
  const slug = slugify(srcTitle);
  const tgText = stripHtml(translated.content);
  const tgHtml = formatTelegram(translated.title, tgText, url);

  const cache = {
    sourceUrl: url,
    sourceTitle: srcTitle,
    sourceLength: ext.content.length,
    featuredImageUrl: ext.ogImage,
    translatedTitle: translated.title,
    translatedContentHtml: translated.content,
    telegramText: tgText,
    telegramHtml: tgHtml,
    slug,
    cachedAt: new Date().toISOString(),
  };
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));

  console.log('\n========================= PREVIEW =========================');
  console.log(`Source URL       : ${url}`);
  console.log(`Source title     : ${srcTitle}`);
  console.log(`Featured image   : ${ext.ogImage || '(none — entry will publish without featuredImage)'}`);
  console.log(`Slug             : ${slug}`);
  console.log(`Translated title : ${translated.title}`);
  console.log(`Content length   : ${translated.content.length} chars HTML / ${tgText.length} chars plain`);
  console.log('\n--- Translated HTML (first 1500 chars) ---');
  console.log(translated.content.slice(0, 1500) + (translated.content.length > 1500 ? '\n...(truncated)' : ''));
  console.log('\n--- Telegram preview (plain text after stripHtml) ---');
  console.log(tgText.slice(0, 1500) + (tgText.length > 1500 ? '\n...(truncated)' : ''));
  console.log('===========================================================');
  console.log(`\nCached at ${CACHE_FILE}`);
  console.log(`Ship with: node ${path.basename(process.argv[1])} --ship`);
}

async function ship() {
  for (const k of ['GEMINI_API_KEY', 'CONTENTFUL_SPACE_ID', 'CONTENTFUL_CMA_TOKEN', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID_1', 'TELEGRAM_CHAT_ID_2']) {
    if (!process.env[k]) { console.error(`Missing required env: ${k}`); process.exit(1); }
  }
  let cache;
  try {
    cache = JSON.parse(await fs.readFile(CACHE_FILE, 'utf8'));
  } catch {
    console.error(`No cached preview at ${CACHE_FILE}. Run dry-run first: node post-from-email.mjs <url>`);
    process.exit(1);
  }
  log(`SHIP — using cache from ${cache.cachedAt}`);
  log(`  source : ${cache.sourceUrl}`);
  log(`  slug   : ${cache.slug}`);
  log(`  title  : ${cache.translatedTitle}`);

  const entryId = await publishToContentful({
    title: cache.translatedTitle,
    content: cache.translatedContentHtml,
    sourceUrl: cache.sourceUrl,
    slug: cache.slug,
    featuredImageUrl: cache.featuredImageUrl,
  });
  log(`  ✅ Contentful: published entry ${entryId} (/html-posts/${cache.slug})`);

  await broadcast(cache.telegramHtml, cache.sourceUrl);
  log(`  ✅ Telegram: broadcast complete`);
}

(async () => {
  if (SHIP) await ship();
  else {
    if (!URL_ARG) {
      console.error('Usage:');
      console.error('  Dry-run: node post-from-email.mjs <url>');
      console.error('  Ship:    node post-from-email.mjs --ship');
      process.exit(1);
    }
    await dryRun(URL_ARG);
  }
})().catch((err) => { console.error('Fatal:', err); process.exit(1); });
