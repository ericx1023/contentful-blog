import { HTMLProps } from 'react';
import { twMerge } from 'tailwind-merge';

import { UnifiedArticleTile } from '@src/components/features/article/UnifiedArticleTile';
import { UnifiedArticle } from '@src/types/article';

interface UnifiedArticleTileGridProps extends HTMLProps<HTMLDivElement> {
  articles?: UnifiedArticle[];
}

export const UnifiedArticleTileGrid = ({
  articles,
  className,
  ...props
}: UnifiedArticleTileGridProps) => {
  return articles && articles.length > 0 ? (
    <div
      className={twMerge(
        'grid grid-cols-1 gap-y-4 gap-x-5 md:grid-cols-3 lg:gap-x-12 lg:gap-y-12',
        className,
      )}
      {...props}
    >
      {articles.map((article, index) => {
        return article ? <UnifiedArticleTile key={index} article={article} /> : null;
      })}
    </div>
  ) : null;
};
