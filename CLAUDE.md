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
- `yarn setup` - Run initial setup script (requires environment variables)

## Environment Variables

Required environment variables (see `.env.example`):
- `CONTENTFUL_SPACE_ID` - Contentful space identifier
- `CONTENTFUL_ACCESS_TOKEN` - Contentful Delivery API token
- `CONTENTFUL_PREVIEW_ACCESS_TOKEN` - Contentful Preview API token
- `CONTENTFUL_PREVIEW_SECRET` - Secret for preview mode (optional)

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