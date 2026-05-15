#!/usr/bin/env node
// Migrate Contentful export -> SQLite + public/images.
// Modes:
//   --dry-run (default): no writes, no copies; prints SQL preview, asset plan, 迷幻 occurrences.
//   --execute:           creates data/posts.db, inserts all rows, copies all assets to public/images/.
// Flags:
//   --sample             limit to one of each post type (for fast inspection)

import { readFile, mkdir, copyFile, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { documentToHtmlString } from '@contentful/rich-text-html-renderer';
import { BLOCKS, INLINES } from '@contentful/rich-text-types';
import { marked } from 'marked';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

const args = new Set(process.argv.slice(2));
const DRY_RUN = !args.has('--execute');
const SAMPLE = args.has('--sample');

const EXPORT_DIR = path.join(REPO_ROOT, 'contentful-backup-20260601');
const ASSETS_DIR = path.join(EXPORT_DIR, 'images.ctfassets.net');
const PUBLIC_IMAGES = path.join(REPO_ROOT, 'public', 'images');
const DATA_DIR = path.join(REPO_ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'posts.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const REPORT_PATH = path.join(__dirname, 'migration-report.md');
const PREFERRED_LOCALE = 'zh-Hant-TW';
const FALLBACK_LOCALE = 'en-US';
const SPACE_ID = 'ljhf0uo4wt6j';

marked.setOptions({ gfm: true, breaks: false });

const log = (...x) => console.log(...x);
const warn = (...x) => console.warn('  ⚠️ ', ...x);

function pickLocale(field) {
  if (!field) return null;
  return field[PREFERRED_LOCALE] ?? field[FALLBACK_LOCALE] ?? null;
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}

function indexById(rows) {
  const m = new Map();
  for (const r of rows) m.set(r.sys.id, r);
  return m;
}

// Returns { src, fileName } using the *on-disk* filename (Contentful CLI sanitises
// spaces/quotes/parens to _). Each <assetId>/<hash>/ dir holds exactly one file.
async function findLocalAssetFile(assetId) {
  const dir = path.join(ASSETS_DIR, SPACE_ID, assetId);
  if (!existsSync(dir)) return null;
  const hashDirs = await readdir(dir);
  for (const hd of hashDirs) {
    const inner = path.join(dir, hd);
    const files = await readdir(inner);
    if (files.length > 0) return { src: path.join(inner, files[0]), fileName: files[0] };
  }
  return null;
}

function buildAssetRelPath(assetId, fileName) {
  return path.join('images', assetId, fileName);
}

function escapeAttr(s) { return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function richTextToHtml(doc, entryIndex, resolveAsset) {
  if (!doc) return '';
  return documentToHtmlString(doc, {
    renderNode: {
      [BLOCKS.EMBEDDED_ASSET]: (node) => {
        const id = node.data?.target?.sys?.id;
        const target = resolveAsset(id);
        if (!target) return `<!-- missing asset ${id} -->`;
        const asset = entryIndex.get(id); // not entries; assets aren't here. We'll get alt from data.assets via closure.
        return `<figure><img src="${target}" alt="" loading="lazy"></figure>`;
      },
      [BLOCKS.EMBEDDED_ENTRY]: (node) => {
        const id = node.data?.target?.sys?.id;
        const entry = entryIndex.get(id);
        if (!entry) return `<!-- missing entry ${id} -->`;
        if (entry.sys.contentType?.sys?.id === 'componentRichImage') {
          const imgLink = pickLocale(entry.fields?.image);
          const imgAssetId = imgLink?.sys?.id;
          const target = imgAssetId ? resolveAsset(imgAssetId) : null;
          if (target) {
            const caption = pickLocale(entry.fields?.caption) || '';
            return `<figure><img src="${target}" alt="${escapeAttr(caption)}" loading="lazy">${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}</figure>`;
          }
        }
        return `<!-- embedded entry ${id} (${entry.sys.contentType?.sys?.id}) not rendered -->`;
      },
      [INLINES.HYPERLINK]: (node, next) => {
        const uri = node.data?.uri || '#';
        return `<a href="${escapeAttr(uri)}" rel="noopener noreferrer">${next(node.content)}</a>`;
      },
    },
  });
}

function normalisePublishedAt(field, sysFallback) {
  const v = pickLocale(field);
  if (!v) return sysFallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v}T00:00:00.000Z`;
  return new Date(v).toISOString();
}

// 迷幻 → 啟靈. Replace anywhere, log every occurrence with surrounding context.
function rewritePsychedelicTerm(text, postSlug, occurrenceLog) {
  if (!text || !text.includes('迷幻')) return text;
  const matches = [];
  let idx = 0;
  while ((idx = text.indexOf('迷幻', idx)) !== -1) {
    const before = text.slice(Math.max(0, idx - 40), idx);
    const after = text.slice(idx + 2, idx + 42);
    matches.push({ postSlug, index: idx, context: `…${before}【迷幻】${after}…` });
    idx += 2;
  }
  for (const m of matches) occurrenceLog.push(m);
  return text.replaceAll('迷幻', '啟靈');
}

// ---- main ----

const exportFile = (await readdir(EXPORT_DIR))
  .find((f) => f.startsWith('contentful-export-') && f.endsWith('.json'));
if (!exportFile) {
  console.error(`No contentful-export-*.json in ${EXPORT_DIR}`);
  process.exit(1);
}
log(`📦 Reading ${exportFile}`);
const data = JSON.parse(await readFile(path.join(EXPORT_DIR, exportFile), 'utf8'));

const assetIndex = indexById(data.assets);
const entryIndex = indexById(data.entries);

const authors = data.entries.filter((e) => e.sys.contentType.sys.id === 'componentAuthor');
let posts = data.entries.filter(
  (e) =>
    e.sys.contentType.sys.id === 'pageBlogPost' ||
    e.sys.contentType.sys.id === 'pageBlogPostWithHtml',
);

if (SAMPLE) {
  const standard = posts.find((p) => p.sys.contentType.sys.id === 'pageBlogPost');
  const rss = posts.find((p) => p.sys.contentType.sys.id === 'pageBlogPostWithHtml');
  posts = [standard, rss].filter(Boolean);
}

log(`📊 Authors: ${authors.length}, Posts: ${posts.length}`);
log(`🧪 Mode: ${DRY_RUN ? 'DRY-RUN' : 'EXECUTE'}\n`);

const occurrenceLog = [];
const warnings = [];
const postRows = [];

// Pre-resolve every asset to its actual on-disk file (Contentful CLI sanitises filenames).
// Map: assetId -> { fileName, src, publicPath } or null if file missing.
const resolvedAssets = new Map();
for (const a of data.assets) {
  const resolved = await findLocalAssetFile(a.sys.id);
  if (!resolved) { resolvedAssets.set(a.sys.id, null); continue; }
  const rel = buildAssetRelPath(a.sys.id, resolved.fileName);
  resolvedAssets.set(a.sys.id, {
    fileName: resolved.fileName,
    src: resolved.src,
    dest: path.join(REPO_ROOT, 'public', rel),
    publicPath: '/' + rel.replace(/\\/g, '/'),
  });
}

const assetCopyPlan = new Map(); // dest -> { src }
function planAssetCopy(assetId, postSlugForWarn) {
  const r = resolvedAssets.get(assetId);
  if (!r) {
    warnings.push(`Asset ${assetId} not on disk (referenced by ${postSlugForWarn})`);
    return null;
  }
  assetCopyPlan.set(r.dest, { src: r.src });
  return r.publicPath;
}

const authorRows = authors.map((a) => {
  const slug = slugify(pickLocale(a.fields.internalName) || a.sys.id);
  const name = (pickLocale(a.fields.name) || slug).trim();
  const avatarLink = pickLocale(a.fields.avatar);
  const avatarPath = avatarLink ? planAssetCopy(avatarLink.sys.id, `author:${slug}`) : null;
  return { slug, name, avatar_path: avatarPath, contentful_id: a.sys.id };
});

const authorSlugByContentfulId = new Map(
  authors.map((a) => [a.sys.id, slugify(pickLocale(a.fields.internalName) || a.sys.id)]),
);

for (const p of posts) {
  const isRss = p.sys.contentType.sys.id === 'pageBlogPostWithHtml';
  const title = pickLocale(p.fields.title);
  const slug = pickLocale(p.fields.slug);
  if (!title || !slug) {
    warnings.push(`Skipping ${p.sys.id}: missing title or slug`);
    continue;
  }

  const subtitle = pickLocale(p.fields.shortDescription);
  const sourceUrl = pickLocale(p.fields.sourceUrl);
  const authorLink = pickLocale(p.fields.author);
  const authorContentfulId = authorLink?.sys?.id;
  const authorSlug = authorContentfulId ? authorSlugByContentfulId.get(authorContentfulId) : null;

  const featuredLink = pickLocale(p.fields.featuredImage);
  const featuredImagePath = featuredLink ? planAssetCopy(featuredLink.sys.id, slug) : null;

  // Render body. Embedded asset refs flow through planAssetCopy so they're queued for copy.
  const resolveAssetForBody = (id) => planAssetCopy(id, `body:${slug}`);
  let bodyHtml;
  if (isRss) {
    const raw = pickLocale(p.fields.html) || '';
    // RSS bodies are markdown + inline HTML (Gemini output).
    bodyHtml = marked.parse(raw);
  } else {
    const doc = pickLocale(p.fields.content);
    bodyHtml = richTextToHtml(doc, entryIndex, resolveAssetForBody);
  }

  // Apply 迷幻 → 啟靈 to title, subtitle, body.
  const titleClean = rewritePsychedelicTerm(title, slug, occurrenceLog);
  const subtitleClean = subtitle ? rewritePsychedelicTerm(subtitle, slug, occurrenceLog) : null;
  const bodyClean = rewritePsychedelicTerm(bodyHtml, slug, occurrenceLog);

  if (!bodyClean.trim()) warnings.push(`Post ${slug}: empty body`);

  const publishedAt = normalisePublishedAt(
    isRss ? p.fields.publishedAt : p.fields.publishedDate,
    p.sys.publishedAt,
  );

  postRows.push({
    authorSlug,
    row: {
      slug,
      title: titleClean,
      subtitle: subtitleClean,
      published_at: publishedAt,
      featured_image_path: featuredImagePath,
      source_url: sourceUrl ?? null,
      body_html: bodyClean,
      origin: isRss ? 'rss' : 'standard',
      contentful_id: p.sys.id,
    },
  });
}

// Sum asset bytes (src already resolved during pre-resolution).
let totalBytes = 0;
for (const [, info] of assetCopyPlan) {
  try { totalBytes += (await stat(info.src)).size; } catch {}
}

// ---- report ----

log('━━━ AUTHORS ━━━');
for (const a of authorRows) log(' ', JSON.stringify(a));
log('');

log('━━━ POSTS (titles + meta) ━━━');
for (const { authorSlug, row } of postRows) {
  log(`  [${row.origin}] ${row.slug}`);
  log(`    title:    ${row.title}`);
  log(`    author:   ${authorSlug ?? '(none)'}`);
  log(`    pub:      ${row.published_at}`);
  log(`    img:      ${row.featured_image_path ?? '(none)'}`);
  log(`    body:     ${row.body_html.length} chars`);
}
log('');

log(`━━━ ASSETS TO COPY ━━━`);
log(`  ${assetCopyPlan.size} files, ${(totalBytes / 1024 / 1024).toFixed(2)} MB total`);
log('');

log(`━━━ 迷幻 → 啟靈 OCCURRENCES ━━━`);
log(`  Total: ${occurrenceLog.length} across ${new Set(occurrenceLog.map((o) => o.postSlug)).size} posts`);
const byPost = new Map();
for (const o of occurrenceLog) {
  if (!byPost.has(o.postSlug)) byPost.set(o.postSlug, []);
  byPost.get(o.postSlug).push(o);
}
for (const [slug, list] of byPost) {
  log(`  · ${slug} (${list.length} occurrences)`);
  for (const o of list.slice(0, 3)) log(`      ${o.context}`);
  if (list.length > 3) log(`      …${list.length - 3} more`);
}
log('');

if (warnings.length) {
  log('━━━ WARNINGS ━━━');
  for (const w of warnings) warn(w);
  log('');
}

// ---- execute ----

if (DRY_RUN) {
  log('✅ Dry-run complete. Re-run with --execute to actually write DB and copy files.');
  process.exit(0);
}

log('━━━ EXECUTING ━━━');

if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });

// If DB exists, refuse to clobber.
if (existsSync(DB_PATH)) {
  console.error(`✗ ${DB_PATH} already exists. Delete it first if you want to re-migrate.`);
  process.exit(1);
}

const db = new Database(DB_PATH);
const schema = await readFile(SCHEMA_PATH, 'utf8');
db.exec(schema);
log(`  ✓ Schema applied to ${path.relative(REPO_ROOT, DB_PATH)}`);

const insertAuthor = db.prepare(
  `INSERT INTO authors (slug, name, avatar_path, contentful_id) VALUES (@slug, @name, @avatar_path, @contentful_id)`,
);
const authorIdBySlug = new Map();
const tx1 = db.transaction(() => {
  for (const a of authorRows) {
    const info = insertAuthor.run(a);
    authorIdBySlug.set(a.slug, info.lastInsertRowid);
  }
});
tx1();
log(`  ✓ ${authorRows.length} authors`);

const insertPost = db.prepare(
  `INSERT INTO posts (slug, title, subtitle, author_id, published_at, featured_image_path, source_url, body_html, origin, contentful_id)
   VALUES (@slug, @title, @subtitle, @author_id, @published_at, @featured_image_path, @source_url, @body_html, @origin, @contentful_id)`,
);
const insertStats = db.prepare(`INSERT INTO post_stats (post_id) VALUES (?)`);
const tx2 = db.transaction(() => {
  for (const { authorSlug, row } of postRows) {
    const info = insertPost.run({ ...row, author_id: authorSlug ? authorIdBySlug.get(authorSlug) ?? null : null });
    insertStats.run(info.lastInsertRowid);
  }
});
tx2();
log(`  ✓ ${postRows.length} posts (+ post_stats rows)`);

// Copy assets.
let copied = 0;
for (const [dest, info] of assetCopyPlan) {
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(info.src, dest);
  copied++;
}
log(`  ✓ ${copied} asset files copied to public/images/`);

db.close();

// Write migration report.
const reportLines = [
  `# Migration report — ${new Date().toISOString()}`,
  ``,
  `- Authors: ${authorRows.length}`,
  `- Posts: ${postRows.length} (${postRows.filter((p) => p.row.origin === 'standard').length} standard, ${postRows.filter((p) => p.row.origin === 'rss').length} rss)`,
  `- Assets copied: ${copied} / ${assetCopyPlan.size}`,
  `- Total asset bytes: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`,
  ``,
  `## 迷幻 → 啟靈 substitutions`,
  ``,
  `Total: **${occurrenceLog.length}** occurrences across **${byPost.size}** posts.`,
  ``,
];
for (const [slug, list] of byPost) {
  reportLines.push(`### ${slug} (${list.length})`);
  for (const o of list) reportLines.push(`- ${o.context.replace(/【迷幻】/g, '**【迷幻→啟靈】**')}`);
  reportLines.push('');
}
if (warnings.length) {
  reportLines.push(`## Warnings`, ``);
  for (const w of warnings) reportLines.push(`- ${w}`);
}
await writeFile(REPORT_PATH, reportLines.join('\n'));
log(`  ✓ Report written to ${path.relative(REPO_ROOT, REPORT_PATH)}`);

log('\n✅ Migration complete.');
