// One-off poster for user-written posts (not RSS-driven).
// Reuses the same .env, Contentful content type, and Telegram targets as
// post-microdose.js. Does NOT touch state.json.
//
// Usage:
//   node post-custom.mjs --file post1.txt --source https://... [--slug my-slug] [--image <url>] [--no-image] [--dry-run]
//
// --image <url> bypasses og:image auto-fetch (useful when the source page
// blocks bot fetches behind a cookie wall, e.g. nature.com).
//
// Input file format: line 1 = title, line 2+ = body paragraphs (blank lines
// allowed). Lines matching /^\d+\.\s/ are emitted as <h2>; a sole "—" line
// becomes <hr/>; everything else becomes <p>.

import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';

const argv = process.argv.slice(2);
const arg = (flag) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : null;
};
const has = (flag) => argv.includes(flag);

const FILE = arg('--file');
const SOURCE_URL = arg('--source');
const SLUG_OVERRIDE = arg('--slug');
const IMAGE_OVERRIDE = arg('--image');
const NO_IMAGE = has('--no-image');
const DRY_RUN = has('--dry-run');

if (!FILE) {
  console.error('Missing --file <path>');
  process.exit(1);
}
if (!SOURCE_URL && !DRY_RUN) {
  console.error('Missing --source <url> (required unless --dry-run)');
  process.exit(1);
}

const REQUIRED_ENV = DRY_RUN
  ? []
  : [
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
} = process.env;

const log = (...args) => console.log(`[${new Date().toISOString()}]`, ...args);

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripHtml(html) {
  return String(html)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/(p|div|li|h[1-6]|br|tr)>/gi, '\n')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<hr\s*\/?\s*>/gi, '\n—\n')
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

// Build HTML body from the text file. First line = title, rest = body.
function buildHtml(text) {
  const lines = text.split(/\r?\n/);
  const title = (lines.shift() || '').trim();
  const blocks = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line === '—' || line === '---') {
      blocks.push('<hr/>');
    } else if (/^\d+\.\s/.test(line)) {
      blocks.push(`<h2>${escapeHtml(line)}</h2>`);
    } else {
      blocks.push(`<p>${escapeHtml(line)}</p>`);
    }
  }
  return { title, html: blocks.join('\n') };
}

async function fetchOgImage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html',
    },
    redirect: 'follow',
  });
  if (!res.ok) return null;
  const html = await res.text();
  const m = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  return m?.[1] || null;
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
  const filePath = path.resolve(FILE);
  const raw = await fs.readFile(filePath, 'utf8');
  const { title, html } = buildHtml(raw);
  if (!title) throw new Error('No title found (first non-empty line of file).');

  const slug = SLUG_OVERRIDE || slugify(title);

  let featuredImageUrl = null;
  if (!NO_IMAGE) {
    if (IMAGE_OVERRIDE) {
      featuredImageUrl = IMAGE_OVERRIDE;
      log(`featured image (override): ${featuredImageUrl}`);
    } else if (SOURCE_URL) {
      try {
        featuredImageUrl = await fetchOgImage(SOURCE_URL);
        log(featuredImageUrl ? `og:image: ${featuredImageUrl}` : 'og:image: (none found)');
      } catch (e) {
        log(`og:image fetch failed: ${String(e.message).slice(0, 120)}`);
      }
    }
  }

  const tgText = stripHtml(html);
  const tgHtml = formatTelegram(title, tgText, SOURCE_URL || '');

  if (DRY_RUN) {
    log('DRY RUN — nothing will be sent.');
    console.log('\n---- TITLE ----');
    console.log(title);
    console.log('\n---- SLUG ----');
    console.log(slug);
    console.log('\n---- SOURCE URL ----');
    console.log(SOURCE_URL || '(none)');
    console.log('\n---- FEATURED IMAGE ----');
    console.log(featuredImageUrl || '(none)');
    console.log('\n---- CONTENTFUL HTML ----');
    console.log(html);
    console.log('\n---- TELEGRAM PLAINTEXT ----');
    console.log(tgText);
    console.log('\n---- TELEGRAM HTML (sent to API) ----');
    console.log(tgHtml + '\n' + (SOURCE_URL || ''));
    return;
  }

  log(`Publishing to Contentful — slug: "${slug}"`);
  const entryId = await publishToContentful({
    title,
    content: html,
    sourceUrl: SOURCE_URL,
    slug,
    featuredImageUrl,
  });
  log(`✅ Contentful entry ${entryId} published.`);
  log(`   Site URL: /html-posts/${slug}  (visible after next ISR regeneration)`);

  log('Broadcasting to Telegram…');
  await broadcast(tgHtml, SOURCE_URL);
  log(
    `✅ Telegram sent to chat_1 (${TELEGRAM_CHAT_ID_1}), chat_2 (${TELEGRAM_CHAT_ID_2})` +
      (TELEGRAM_BOT_TOKEN_2 && TELEGRAM_CHAT_ID_3 ? `, chat_3 (${TELEGRAM_CHAT_ID_3})` : '') +
      '.',
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });
