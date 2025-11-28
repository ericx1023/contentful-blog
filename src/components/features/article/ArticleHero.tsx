import { useContentfulInspectorMode } from '@contentful/live-preview/react';
import { useTranslation } from 'next-i18next';
import { twMerge } from 'tailwind-merge';
import Link from 'next/link';
import dayjs from 'dayjs';

import { ArticleAuthor } from '@src/components/features/article/ArticleAuthor';
import { ArticleLabel } from '@src/components/features/article/ArticleLabel';
import { CtfImage } from '@src/components/features/contentful';
import { FormatDate } from '@src/components/shared/format-date';
import { PageBlogPostFieldsFragment } from '@src/lib/__generated/sdk';
import { Container } from '@src/components/shared/container';

interface ArticleHeroProps {
  article: PageBlogPostFieldsFragment;
  isFeatured?: boolean;
  isReversedLayout?: boolean;
}
export const ArticleHero = ({
  article,
  isFeatured,
  isReversedLayout = false,
}: ArticleHeroProps) => {
  const { t } = useTranslation();
  const inspectorProps = useContentfulInspectorMode({ entryId: article.sys.id });

  const { title, shortDescription, publishedDate } = article;

  return (
    <div
      className={twMerge(`flex flex-col overflow-hidden`)}>
      <div className='mx-auto px-4 sm:px-6 lg:px-8 mt-8 max-w-4xl w-full'>
        <div className="relative flex flex-1 basis-1/2 flex-col justify-center">
          <div className="mb-2 flex flex-wrap items-center">
            {isFeatured && (
              <ArticleLabel
                className={twMerge(
                  'ml-auto pl-2 lg:absolute lg:top-8 xl:top-12',
                  isReversedLayout ? 'lg:left-6 xl:left-12' : 'lg:right-6 xl:right-12',
                )}>
                {t('article.featured')}
              </ArticleLabel>
            )}
          </div>
        </div>
      </div>
      <div className='max-w-5xl mx-auto w-full'>
        <div className='max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8'>
          <time dateTime={publishedDate} className='block text-purple-light font-mono text-base'>{dayjs(publishedDate).format('MMM DD, YYYY')}</time>
          <h1 className="mb-12 mt-8 text-5xl lg:text-[3rem] leading-tight text-purple-dark text-wrap" {...inspectorProps({ fieldId: 'title' })}>{title}</h1>
          <ArticleAuthor article={article} />
        </div>
        <div className="max-h-[600px] rounded-lg h-[600px] mt-12 overflow-hidden flex items-center justify-center" {...inspectorProps({ fieldId: 'featuredImage' })}>
          {article.featuredImage && (
            <CtfImage
              nextImageProps={{ className: 'w-full h-full object-cover', priority: true, sizes: undefined }}
              {...article.featuredImage}
            />
          )}
        </div>
      </div>
      <div className='mx-auto px-4 sm:px-6 lg:px-8 mt-8 max-w-3xl w-full'>
        {shortDescription && (
          <p className="mt-10 mb-12 rounded bg-[#F4F2F4] font-semibold leading-normal p-6 md:p-12 text-xl text-purple-medium text-center" {...inspectorProps({ fieldId: 'shortDescription' })}>
            {shortDescription}
          </p>
        )}
      </div>
    </div>
  );
};
