import { useContentfulInspectorMode } from '@contentful/live-preview/react';
import Link from 'next/link';
import { HTMLProps } from 'react';
import { twMerge } from 'tailwind-merge';

import { ArticleAuthor } from '@src/components/features/article/ArticleAuthor';
import { CtfImage } from '@src/components/features/contentful';
import { FormatDate } from '@src/components/shared/format-date';
import { ArticleType, UnifiedArticle } from '@src/types/article';
import {
  PageBlogPost,
  PageBlogPostFieldsFragment,
  PageBlogPostWithHtml,
} from '@src/lib/__generated/sdk';

interface UnifiedArticleTileProps extends HTMLProps<HTMLDivElement> {
  article: UnifiedArticle;
}

export const UnifiedArticleTile = ({ article, className }: UnifiedArticleTileProps) => {
  const { title, publishedDate, articleType, author, featuredImage } = article;

  // 根據文章類型決定路徑
  const articlePath =
    articleType === ArticleType.MARKDOWN ? `/html-posts/${article.slug}` : `/${article.slug}`;

  // 始終調用 Hook，但根據文章類型決定是否使用結果
  const inspectorMode = useContentfulInspectorMode({ entryId: article.sys.id });
  const inspectorProps = (fieldId: string) => {
    return articleType === ArticleType.STANDARD ? inspectorMode({ fieldId }) : {};
  };

  // 獲取圖片 - 直接使用 UnifiedArticle 上的 featuredImage
  const hasImage = !!featuredImage;

  // 判斷是否有作者
  const hasAuthor = !!author;

  // 創建一個兼容標準文章類型的對象供 ArticleAuthor 使用
  const authorCompatArticle = {
    sys: { id: article.sys.id },
    author: author,
  } as PageBlogPostFieldsFragment;

  return (
    <Link className="flex flex-col" href={articlePath}>
      <div
        className={twMerge(
          'flex flex-1 flex-col overflow-hidden rounded-2xl border border-gray300 shadow-lg',
          className,
        )}
      >
        {hasImage && (
          <div {...inspectorProps('featuredImage')}>
            <CtfImage
              nextImageProps={{ className: 'object-cover aspect-[16/10] w-full' }}
              {...featuredImage}
            />
          </div>
        )}
        <div className="flex flex-1 flex-col py-3 px-4 md:px-5 md:py-4 lg:px-7 lg:py-5">
          {/* 文章類型標籤 */}
          <div className="mb-2">
            <span
              className={`rounded py-1 px-2 text-xs font-medium ${
                articleType === ArticleType.MARKDOWN
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              {/* {articleType === ArticleType.MARKDOWN ? 'Markdown' : '標準'} */}
            </span>
          </div>

          {title && (
            <p className="h3 mb-2 text-gray800 md:mb-3" {...inspectorProps('title')}>
              {title}
            </p>
          )}

          <div className="mt-auto flex items-center">
            {/* 顯示作者 - 無論是標準還是 Markdown 文章 */}
            {hasAuthor && <ArticleAuthor article={authorCompatArticle} />}

            {/* 如果有發布日期則顯示 */}
            {publishedDate && (
              <div
                className={twMerge(hasAuthor ? 'ml-auto pl-2' : '', 'text-xs text-gray600')}
                {...inspectorProps('publishedDate')}
              >
                <FormatDate date={publishedDate ? new Date(publishedDate) : undefined} />
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};
