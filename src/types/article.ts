import {
  Asset,
  AuthorFieldsFragment,
  PageBlogPost,
  PageBlogPostWithHtml,
} from '@src/lib/__generated/sdk';

// 定義混合文章類型的來源
export enum ArticleType {
  STANDARD = 'standard',
  MARKDOWN = 'markdown',
}

// 統一文章格式，用於顯示和混合排序
export interface UnifiedArticle {
  sys: {
    id: string;
    spaceId: string;
    publishedAt?: string;
    firstPublishedAt?: string;
  };
  slug?: string | null;
  title?: string | null;
  internalName?: string | null;
  publishedDate?: string | null;
  shortDescription?: string | null;
  author?: any;
  featuredImage?: any;
  articleType: ArticleType;
  originalData: PageBlogPost | PageBlogPostWithHtml;
}

// 將標準部落格文章轉換為統一格式
export const mapStandardToUnified = (article: PageBlogPost): UnifiedArticle => ({
  sys: article.sys,
  slug: article.slug,
  title: article.title,
  internalName: article.internalName,
  publishedDate: article.publishedDate,
  shortDescription: article.shortDescription,
  author: article.author,
  featuredImage: article.featuredImage,
  articleType: ArticleType.STANDARD,
  originalData: article,
});

// 將 Markdown 部落格文章轉換為統一格式
export const mapHtmlToUnified = (article: PageBlogPostWithHtml): UnifiedArticle => {
  // 為 Markdown 文章創建一個臨時變量用於發布日期
  // 如果 API 沒有返回這些值，我們將使用當前時間作為臨時解決方案
  const publishedAt =
    article.sys?.publishedAt || article.sys?.firstPublishedAt || new Date().toISOString();

  // 確保我們有作者和圖片數據
  const author = article.author || null;
  const featuredImage = article.featuredImage || null;

  return {
    sys: {
      ...article.sys,
      // 保存系統的發布時間，用於排序
      publishedAt,
    },
    slug: article.slug,
    title: article.title,
    internalName: article.internalName,
    // 使用系統發布時間作為發布日期
    publishedDate: publishedAt,
    shortDescription: null, // Markdown 文章沒有短描述
    author: author,
    featuredImage: featuredImage,
    articleType: ArticleType.MARKDOWN,
    originalData: article,
  };
};

// 合併和排序文章
export const mergeAndSortArticles = (
  standardArticles: Array<PageBlogPost | null> = [],
  htmlArticles: Array<PageBlogPostWithHtml | null> = [],
): UnifiedArticle[] => {
  // 過濾掉 null 項
  const filteredStandard = standardArticles.filter(article => article) as PageBlogPost[];
  const filteredHtml = htmlArticles.filter(article => article) as PageBlogPostWithHtml[];

  // 轉換為統一格式
  const mappedStandard = filteredStandard.map(mapStandardToUnified);
  const mappedHtml = filteredHtml.map(mapHtmlToUnified);

  // 合併兩種類型的文章
  const allArticles = [...mappedStandard, ...mappedHtml];

  // 按發布日期排序，最新的在前
  return allArticles.sort((a, b) => {
    const dateA = a.publishedDate || a.sys.publishedAt;
    const dateB = b.publishedDate || b.sys.publishedAt;

    // 如果沒有日期，假設是最舊的
    if (!dateA) return 1;
    if (!dateB) return -1;

    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });
};
