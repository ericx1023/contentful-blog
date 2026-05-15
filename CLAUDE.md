# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js blog application powered by Contentful CMS. It supports both standard Contentful rich text articles and HTML/Markdown articles, with a unified presentation layer, live preview capabilities, and internationalization support.

## Development Commands

### Core Development
- `yarn dev` - Start development server on `http://localhost:3000`
- `yarn build` - Build production application
- `yarn start` - Start production server
- `yarn lint` - Run ESLint
- `yarn type-check` - Run TypeScript compiler without emitting files

### GraphQL Code Generation
- `yarn graphql-codegen:generate` - Generate GraphQL schema, types, and SDK from Contentful
- `yarn graphql-codegen:watch` - Watch mode for GraphQL generation (runs on `.graphql` file changes)

### Setup
- `yarn setup` - Run initial setup script that copies .env.example to .env and starts dev server
- `yarn` - Install dependencies (requires Node.js v18+ as specified in .nvmrc)

## Environment Variables

Required environment variables (see `.env.example`):
- `CONTENTFUL_SPACE_ID` - Contentful space identifier
- `CONTENTFUL_ACCESS_TOKEN` - Contentful Delivery API token
- `CONTENTFUL_PREVIEW_ACCESS_TOKEN` - Contentful Preview API token
- `CONTENTFUL_PREVIEW_SECRET` - Secret for preview mode (optional)
- `NEXT_PUBLIC_ISSO_URL` - URL of the Isso comment server (optional; comments are skipped if unset)

## Architecture

### Dual Content Type System
The application supports two types of articles:
1. **Standard Articles** - Using Contentful's rich text fields
2. **Markdown Articles** - Using HTML/Markdown content stored in Contentful

Both are unified through:
- `UnifiedArticle` interface in `src/types/article.ts`
- `UnifiedArticleTile` component for consistent display
- Extended SDK with custom GraphQL queries in `src/lib/extended-sdk.ts`

### Data Flow
1. GraphQL schemas are generated from Contentful API via `codegen.ts`
2. Base SDK is generated in `src/lib/__generated/sdk.ts`
3. Extended SDK (`src/lib/extended-sdk.ts`) adds custom queries for HTML content
4. Pages use `getStaticProps` with client from `src/lib/client.ts`
5. Live preview updates are handled via `@contentful/live-preview`

### Key Directories
- `src/components/features/` - Feature-specific components (article, contentful, language-selector, seo)
- `src/components/shared/` - Reusable utility components
- `src/components/templates/` - Layout and structural components
- `src/lib/` - Data fetching, client setup, and generated GraphQL code
- `src/lib/graphql/` - GraphQL query definitions (source for codegen)
- `src/pages/` - Next.js pages with different routing patterns:
  - `[slug].page.tsx` - Standard article pages
  - `html-posts/[slug].page.tsx` - Markdown article pages
  - Note: `next.config.js` sets `pageExtensions: ['page.tsx', ...]`, so only files ending in `.page.tsx`/`.page.ts` are treated as routable pages. Co-located helpers (e.g. `utils/`, `*.test.tsx`) are ignored by the router.
- `src/contexts/ThemeContext.tsx` - Light/dark mode provider, wired in `_app.page.tsx`. Components opt into dark variants via Tailwind `dark:` classes.
- `isso-server/` - Self-hosted [Isso](https://posativ.org/isso/) comment server (Dockerfile + `isso.conf`) deployed to Render via `render.yaml`. The Next.js client loads `embed.min.js` from `NEXT_PUBLIC_ISSO_URL`.
- `scripts/post-microdose/` - Standalone Node ESM ingestion pipeline (own `package.json` / `node_modules`, **not** part of the Next app's deps). Polls 10 psychedelic-news RSS feeds → keyword filter → Mozilla Readability fetches the full source article → Gemini translates HTML → uploads `og:image` as a Contentful Asset → publishes a `pageBlogPostWithHtml` entry → broadcasts a stripped-text version to multiple Telegram chats. Runs daily via `~/Library/LaunchAgents/com.shenghao.microdose.plist` (LaunchAgent's `StartCalendarInterval` catches up missed firings on wake/login). See its own section below for invocation flags and operational details.

### Custom Styling
- Uses Tailwind CSS with custom design tokens from `@contentful/f36-tokens`
- Professional color scheme defined in `tailwind.config.js`
- Path aliases: `@src/*`, `@public/*`, `@icons/*`

## Development Guidelines

### GraphQL Changes
When modifying GraphQL queries:
1. Edit `.graphql` files in `src/lib/graphql/`
2. Run `yarn graphql-codegen:generate` to update types
3. Update extended SDK if adding custom queries
4. Commit generated files in `src/lib/__generated/`

### Adding New Content Types
1. Create GraphQL fragments in `src/lib/graphql/`
2. Add to appropriate collection queries
3. Update TypeScript interfaces in `src/types/`
4. Extend unified article system if needed

### Component Development
- Follow feature-based organization in `src/components/features/`
- Use shared components for common UI elements
- Leverage Contentful's live preview for content components
- Use TypeScript interfaces extending generated GraphQL types

### Preview Mode
- Draft content accessible via `/api/draft?secret=<token>&slug=<slug>`
- Disable with `/api/disable-draft`
- Live updates enabled in development and preview modes

### RSS ingestion pipeline (`scripts/post-microdose/`)
Replaces an old n8n workflow on GCP that polled a single Substack feed. Now Mac-local. Key files:
- `post-microdose.js` - main ESM entry point. Modes (CLI flags): `--seed` (mark all current feed items as seen without processing — run once before going live), `--test-telegram <feed>` (translate latest item, broadcast to Telegram, no Contentful, no state save), `--test-contentful <feed>` (publish to Contentful, no Telegram, no state save), `--delete-slug <slug>` (unpublish + delete entry **and** its `featuredImage` asset). With no flag, runs the full production pipeline.
- `run.sh` - launchd wrapper. Sources nvm so the right `node` is on PATH after upgrades, and exports the macOS keychain (System + SystemRoots + login) into `~/.cache/post-microdose-ca-bundle.pem` then sets `NODE_EXTRA_CA_CERTS`. The keychain export is what makes the script work on networks with TLS-inspecting firewalls (FortiGate, Zscaler, etc.) — Node's bundled CA list doesn't see corporate roots installed in the macOS keychain.
- `state.json` - persistent dedupe set (`{seen: [...]}` capped at 2000 entries, ~1 month of memory). Saved after each item — both successful posts and keyword-filter skips. **Don't delete this file** unless you intend a re-flood.
- `validate-feeds.mjs` / `dry-run-filter.mjs` - one-off diagnostics. Re-runnable: validate adds + preview which items the keyword filter would keep without burning Gemini quota.
- Source RSS list and keyword vocabulary live in `.env` (`RSS_URLS`, `KEYWORDS`); `.env.example` is a placeholder template (do **not** commit real secrets there).

Behaviour worth knowing before changing it:
- Article body comes from **Readability extraction of the source URL**, not the RSS `content:encoded` — many of the feeds (e.g. psychedelicstoday) only ship a one-paragraph teaser in RSS. The Gemini prompt is HTML-aware and instructs the model to preserve `<img>` / `<a>` / `<figure>` tags and to translate `psychedelic` strictly as 啟靈藥/啟靈 (never 迷幻藥/迷幻).
- Featured image upload goes through Contentful's full 4-step asset flow: create draft → trigger `/process` (Contentful fetches the URL itself) → poll for processed file URL → publish. If entry create or publish then fails, `rollbackAsset()` deletes the orphan asset so retries don't pile up junk.
- Translated HTML is what's stored in Contentful. For Telegram, `stripHtml()` collapses it back to plain text (so the Telegram message stays readable) — same translation, two presentations.
- State save happens *after* every successful publish AND after every filter-skip — a keyword miss still marks the item as seen so we don't re-evaluate it forever.
- Locale is `zh-Hant-TW` for all entry fields (the content type's required locale). Override via `CONTENTFUL_LOCALE` env if the model ever changes.
- Two Telegram bots are configured (bot 1 = `@sheng_blogging_agent_n8n_bot`, bot 2 = `@psychedelic_news_zh_bot`). Bot 2 only fires if both `TELEGRAM_BOT_TOKEN_2` and `TELEGRAM_CHAT_ID_3` are set — it's an additive third destination, not a replacement.

Operations:
- Manually trigger: `launchctl start com.shenghao.microdose` then `tail -f ~/Library/Logs/microdose.{out,err}.log`.
- Check schedule: `launchctl list | grep microdose` (PID `-` = idle, normal).
- Re-install after editing the plist: `launchctl unload ... && launchctl load ...`.

### Comments (Isso)
- The Isso embed script is loaded once globally in `src/pages/_app.page.tsx`, not per-page. `_app` first pings `${NEXT_PUBLIC_ISSO_URL}/js/embed.min.js` to wake the Render free-tier instance (cold starts can take 30–60s) and only injects the `<Script>` tag once the server responds.
- Per-page rendering lives in `src/components/shared/Comments.tsx`, which creates an `#isso-thread` element keyed on the route and calls `window.Isso.init()`. It coordinates with `_app` via the `window.issoScriptLoaded` / `window.issoLoadFailed` flags — preserve that contract when changing either file.
- CSP in `config/headers.js` must allow the Isso origin (script-src, connect-src, frame-src). Update it whenever `NEXT_PUBLIC_ISSO_URL` changes.
- `node scripts/test-isso-server.js` probes the server's embed and main endpoints; useful when debugging cold-start or CORS issues.
- Background and rationale: `docs/isso-cold-start-solution.md` (in 繁體中文).

## Testing and Quality

### Pre-commit Hooks
- TypeScript compilation check (`tsc --noEmit`)
- ESLint and Prettier via `lint-staged`
- Uses Husky for git hooks

### Commands for Quality Checks
- `yarn type-check` - TypeScript validation
- `yarn lint` - ESLint validation
- Both run automatically on commit and push

## Deployment

Optimized for Vercel and Netlify with:
- Static generation with ISR
- Image optimization for Contentful assets
- Sitemap generation
- PWA capabilities via `next-pwa`

Always run `yarn type-check` and `yarn lint` before commits to ensure code quality.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
