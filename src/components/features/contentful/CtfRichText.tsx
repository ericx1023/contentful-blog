import { documentToReactComponents, Options } from '@contentful/rich-text-react-renderer';
import { BLOCKS, Document, INLINES } from '@contentful/rich-text-types';

import { ArticleImage } from '@src/components/features/article';
import { ComponentRichImage } from '@src/lib/__generated/sdk';
import { CtfEmbed } from './CtfEmbed';

export type EmbeddedEntryType =
  | ComponentRichImage
  | Pick<
      import('@src/lib/__generated/sdk').PageBlogPostWithHtml,
      '__typename' | 'sys' | 'sourceUrl' | 'title' | 'featuredImage'
    >
  | null;
export interface ContentfulRichTextInterface {
  json: Document;
  links?:
    | {
        entries: {
          block: Array<EmbeddedEntryType>;
        };
      }
    | any;
}

export const EmbeddedEntry = (entry: EmbeddedEntryType) => {
  switch (entry?.__typename) {
    case 'ComponentRichImage':
      return <ArticleImage image={entry} />;
    case 'PageBlogPostWithHtml':
      return <CtfEmbed embed={entry} />;
    default:
      return null;
  }
};

export const contentfulBaseRichTextOptions = ({ links }: ContentfulRichTextInterface): Options => ({
  renderNode: {
    [BLOCKS.EMBEDDED_ENTRY]: node => {
      const entry = links?.entries?.block?.find(
        (item: EmbeddedEntryType) => item?.sys?.id === node.data.target.sys.id,
      );

      if (!entry) return null;

      return <EmbeddedEntry {...entry} />;
    },
    [INLINES.HYPERLINK]: node => {
      if (node.data.uri.includes('player.vimeo.com/video')) {
        return (
          <span className="IframeContainer">
            <iframe title="Unique Title 001" src={node.data.uri} frameBorder="0" allowFullScreen />
          </span>
        );
      } else if (node.data.uri.includes('youtube.com/embed')) {
        return (
          <span className="IframeContainer">
            <iframe
              title="Unique Title 002"
              src={node.data.uri}
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              frameBorder="0"
              allowFullScreen
            />
          </span>
        );
      } else {
        return (
          <a href={node.data.uri} target="_blank" rel="noopener noreferrer">
            {node.content[0].nodeType === 'text' ? node.content[0].value : node.data.uri}
          </a>
        );
      }
    },
  },
});

export const CtfRichText = ({ json, links }: ContentfulRichTextInterface) => {
  const baseOptions = contentfulBaseRichTextOptions({ links, json });

  return (
    <article className="prose prose-sm max-w-none">
      {documentToReactComponents(json, baseOptions)}
    </article>
  );
};
