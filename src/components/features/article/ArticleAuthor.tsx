import { useContentfulInspectorMode } from '@contentful/live-preview/react';

import { CtfImage } from '@src/components/features/contentful';
import { AuthorFieldsFragment, PageBlogPostFieldsFragment } from '@src/lib/__generated/sdk';

interface ArticleAuthorProps {
  article:
    | PageBlogPostFieldsFragment
    | { author: AuthorFieldsFragment | null | undefined; sys: { id: string } };
}

export const ArticleAuthor = ({ article }: ArticleAuthorProps) => {
  const { author } = article;

  // 始終調用 Hook，但在沒有 author 的情況下傳入一個佔位符 ID
  const entryId = author?.sys?.id || 'placeholder-id';
  const inspectorMode = useContentfulInspectorMode({ entryId });

  const inspectorProps = (fieldId: string) => {
    return author?.sys?.id ? inspectorMode({ fieldId }) : {};
  };

  // 如果沒有作者或作者沒有必要的屬性，返回 null
  if (!author || !author.name) {
    return null;
  }

  return (
    <div className="flex items-center">
      <div
        className="mr-2 overflow-hidden rounded-full"
        {...inspectorProps('avatar')}
      >
        {author.avatar && (
          <CtfImage
            nextImageProps={{
              width: 28,
              height: 28,
              sizes: undefined,
              placeholder: undefined,
            }}
            {...author.avatar}
          />
        )}
      </div>
      <span className="text-base leading-none font-medium text-purple-dark/70" {...inspectorProps('name')}>
        {author.name}
      </span>
    </div>
  );
};
