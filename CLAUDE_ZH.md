# CLAUDE.md

本文件為 Claude Code (claude.ai/code) 在此儲存庫中工作時提供指導。

## 專案概述

這是一個由 Contentful CMS 驅動的 Next.js 部落格應用程式。它支援標準的 Contentful 富文本文章和 HTML/Markdown 文章，具有統一的展示層、即時預覽功能和國際化支援。

## 開發指令

### 核心開發
- `yarn dev` - 在 `http://localhost:3000` 啟動開發伺服器
- `yarn build` - 建置正式環境應用程式
- `yarn start` - 啟動正式環境伺服器
- `yarn lint` - 執行 ESLint
- `yarn type-check` - 執行 TypeScript 編譯器但不輸出檔案

### GraphQL 程式碼生成
- `yarn graphql-codegen:generate` - 從 Contentful 生成 GraphQL schema、型別和 SDK
- `yarn graphql-codegen:watch` - GraphQL 生成的監視模式（在 `.graphql` 檔案變更時執行）

### 設定
- `yarn setup` - 執行初始設定腳本（需要環境變數）

## 環境變數

必要的環境變數（請參考 `.env.example`）：
- `CONTENTFUL_SPACE_ID` - Contentful 空間識別碼
- `CONTENTFUL_ACCESS_TOKEN` - Contentful Delivery API 令牌
- `CONTENTFUL_PREVIEW_ACCESS_TOKEN` - Contentful Preview API 令牌
- `CONTENTFUL_PREVIEW_SECRET` - 預覽模式的密鑰（可選）

## 架構

### 雙重內容類型系統
應用程式支援兩種類型的文章：
1. **標準文章** - 使用 Contentful 的富文本欄位
2. **Markdown 文章** - 使用儲存在 Contentful 中的 HTML/Markdown 內容

兩者透過以下方式統一：
- `src/types/article.ts` 中的 `UnifiedArticle` 介面
- `UnifiedArticleTile` 元件提供一致的顯示
- `src/lib/extended-sdk.ts` 中具有自訂 GraphQL 查詢的擴充 SDK

### 資料流程
1. GraphQL schemas 透過 `codegen.ts` 從 Contentful API 生成
2. 基礎 SDK 在 `src/lib/__generated/sdk.ts` 中生成
3. 擴充 SDK（`src/lib/extended-sdk.ts`）為 HTML 內容添加自訂查詢
4. 頁面使用來自 `src/lib/client.ts` 的 client 搭配 `getStaticProps`
5. 即時預覽更新透過 `@contentful/live-preview` 處理

### 主要目錄
- `src/components/features/` - 特定功能元件（article、contentful、language-selector、seo）
- `src/components/shared/` - 可重複使用的工具元件
- `src/components/templates/` - 版面配置和結構元件
- `src/lib/` - 資料獲取、client 設定和生成的 GraphQL 程式碼
- `src/lib/graphql/` - GraphQL 查詢定義（codegen 的來源）
- `src/pages/` - Next.js 頁面，具有不同的路由模式：
  - `[slug].page.tsx` - 標準文章頁面
  - `html-posts/[slug].page.tsx` - Markdown 文章頁面

### 自訂樣式
- 使用 Tailwind CSS 搭配來自 `@contentful/f36-tokens` 的自訂設計 tokens
- 在 `tailwind.config.js` 中定義的專業配色方案
- 路徑別名：`@src/*`、`@public/*`、`@icons/*`

## 開發指南

### GraphQL 變更
修改 GraphQL 查詢時：
1. 編輯 `src/lib/graphql/` 中的 `.graphql` 檔案
2. 執行 `yarn graphql-codegen:generate` 更新型別
3. 如添加自訂查詢，請更新擴充 SDK
4. 提交 `src/lib/__generated/` 中的生成檔案

### 添加新內容類型
1. 在 `src/lib/graphql/` 中建立 GraphQL fragments
2. 添加到適當的集合查詢中
3. 更新 `src/types/` 中的 TypeScript 介面
4. 如需要，擴充統一文章系統

### 元件開發
- 遵循 `src/components/features/` 中基於功能的組織架構
- 對常見 UI 元素使用共享元件
- 為內容元件運用 Contentful 的即時預覽功能
- 使用擴展生成的 GraphQL 型別的 TypeScript 介面

### 預覽模式
- 草稿內容可透過 `/api/draft?secret=<token>&slug=<slug>` 存取
- 透過 `/api/disable-draft` 停用
- 在開發和預覽模式中啟用即時更新

## 測試和品質

### 提交前 Hooks
- TypeScript 編譯檢查（`tsc --noEmit`）
- 透過 `lint-staged` 執行 ESLint 和 Prettier
- 使用 Husky 處理 git hooks

### 品質檢查指令
- `yarn type-check` - TypeScript 驗證
- `yarn lint` - ESLint 驗證
- 兩者在提交和推送時自動執行

## 部署

針對 Vercel 和 Netlify 最佳化，具備：
- 使用 ISR 的靜態生成
- Contentful 資產的圖片最佳化
- Sitemap 生成
- 透過 `next-pwa` 的 PWA 功能

提交前請務必執行 `yarn type-check` 和 `yarn lint` 以確保程式碼品質。
