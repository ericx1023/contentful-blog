import { useContentfulInspectorMode } from '@contentful/live-preview/react';
import { useTranslation } from 'next-i18next';
import { twMerge } from 'tailwind-merge';
import Link from 'next/link';

import { ArticleAuthor } from './ArticleAuthor';
import { ArticleLabel } from '@src/components/features/article/ArticleLabel';
import { CtfImage } from '@src/components/features/contentful';
import { FormatDate } from '@src/components/shared/format-date';
import { PageBlogPostFieldsFragment } from '@src/lib/__generated/sdk';
import { Container } from '@src/components/shared/container';

interface HeroSectionProps {
  article: PageBlogPostFieldsFragment;
}
export const HeroSection = ({
  article,
}: HeroSectionProps) => {
  const { t } = useTranslation();
  const inspectorProps = useContentfulInspectorMode({ entryId: article.sys.id });

  const { title, shortDescription, publishedDate } = article;

  return (
    <div className={twMerge(`flex overflow-hidden`)}>
      <div className="flex-[2_2_0] max-h-[350px] overflow-hidden rounded-sm flex items-center justify-center bg-gray-100" {...inspectorProps({ fieldId: 'featuredImage' })}>
        {article.featuredImage && (
          <CtfImage
            nextImageProps={{ className: 'w-full h-full object-cover', priority: true, sizes: undefined }}
            {...article.featuredImage}
          />
        )}
      </div>
      <div className='flex-[1_1_0] px-4 sm:px-6 lg:px-8 mt-8 max-w-4xl w-full'>
        <div className="relative flex flex-1 basis-1/2 flex-col justify-center h-full">
          <h1 className="mb-5 text-3xl leading-snug text-purple-dark" {...inspectorProps({ fieldId: 'title' })}>{title}</h1>
          {shortDescription && (
            <p className="text-purple-medium/70 line-clamp-3" {...inspectorProps({ fieldId: 'shortDescription' })}>
              {shortDescription}
            </p>
          )}
          <div className="flex items-center justify-between mt-auto mb-3 text-purple-light">
            <ArticleAuthor article={article} />
            <div
              className="text-purple-light font-mono"
              {...inspectorProps({ fieldId: 'publishedDate' })}>
              <FormatDate date={publishedDate} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
