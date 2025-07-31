import { useContentfulLiveUpdates } from '@contentful/live-preview/react';

import { PageBlogPostWithHtml, Asset } from '@src/lib/__generated/sdk';

// Helper function to validate URL
const validateUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Helper function to safely get hostname
const getSafeHostname = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return 'Invalid URL';
  }
};

interface EmbedProps {
  sourceUrl: string;
  title?: string;
  featuredImage?: Asset | null;
}

interface PageBlogPostWithHtmlEmbedProps {
  embed: Pick<PageBlogPostWithHtml, '__typename' | 'sys' | 'sourceUrl' | 'title' | 'featuredImage'>;
}

const EmbedRenderer = ({ sourceUrl, title, featuredImage }: EmbedProps) => {
  // Early return if URL is invalid
  if (!validateUrl(sourceUrl)) {
    return (
      <div className="not-prose border-gray-200 my-6 overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="p-4">
          <div className="from-red-50 to-orange-100 mb-4 flex aspect-video w-full items-center justify-center rounded-lg bg-gradient-to-br">
            <div className="text-center">
              <div className="bg-red-500 mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg">
                <svg
                  className="h-6 w-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <p className="text-red-600 text-sm">Invalid URL</p>
            </div>
          </div>
          {title && <h3 className="text-gray-900 line-clamp-2 mb-2 font-semibold">{title}</h3>}
          <div className="text-gray-500 text-xs">
            <span className="truncate">{sourceUrl}</span>
          </div>
        </div>
      </div>
    );
  }

  // Handle different types of embeds
  const isYouTube = sourceUrl.includes('youtube.com') || sourceUrl.includes('youtu.be');
  const isVimeo = sourceUrl.includes('vimeo.com');
  const isCodePen = sourceUrl.includes('codepen.io');

  // Extract video IDs for direct embedding
  const getYouTubeId = (url: string) => {
    const match = url.match(
      /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/,
    );
    return match ? match[1] : null;
  };

  const getVimeoId = (url: string) => {
    const match = url.match(/vimeo\.com\/(?:.*#|.*\/videos\/)?([0-9]+)/);
    return match ? match[1] : null;
  };

  if (isYouTube) {
    const videoId = getYouTubeId(sourceUrl);
    if (videoId) {
      return (
        <div className="bg-gray-100 relative aspect-video w-full overflow-hidden rounded-lg">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title={title || 'YouTube video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      );
    }
  }

  if (isVimeo) {
    const videoId = getVimeoId(sourceUrl);
    if (videoId) {
      return (
        <div className="bg-gray-100 relative aspect-video w-full overflow-hidden rounded-lg">
          <iframe
            src={`https://player.vimeo.com/video/${videoId}`}
            title={title || 'Vimeo video'}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      );
    }
  }

  if (isCodePen) {
    const penId = sourceUrl.split('/pen/')[1]?.split('/')[0];
    if (penId) {
      return (
        <div
          className="bg-gray-100 relative w-full overflow-hidden rounded-lg"
          style={{ height: 400 }}
        >
          <iframe
            src={`https://codepen.io/embed/${penId}?default-tab=result`}
            title={title || 'CodePen'}
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      );
    }
  }

  // Generic embed with rich preview (fallback)
  const hostname = getSafeHostname(sourceUrl);

  return (
    <div className="not-prose border-gray-200 my-6 overflow-hidden rounded-lg border bg-white shadow-sm">
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block transition-all hover:shadow-md"
      >
        {featuredImage?.url ? (
          <div className="bg-gray-100 aspect-video w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={featuredImage.url}
              alt={title || 'Preview'}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="from-blue-50 to-indigo-100 flex aspect-video w-full items-center justify-center bg-gradient-to-br">
            <div className="text-center">
              <div className="bg-blue-500 mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg">
                <svg
                  className="h-6 w-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              </div>
              <p className="text-gray-600 text-sm">External Link</p>
            </div>
          </div>
        )}
        <div className="p-4">
          {title && <h3 className="text-gray-900 line-clamp-2 mb-2 font-semibold">{title}</h3>}
          <div className="flex items-center justify-between">
            <div className="text-gray-500 flex items-center text-xs">
              <span className="truncate">{hostname}</span>
            </div>
            <div className="text-blue-600 text-xs font-medium">View Article →</div>
          </div>
        </div>
      </a>
    </div>
  );
};

export const CtfEmbed = ({ embed }: PageBlogPostWithHtmlEmbedProps) => {
  const liveEmbed = useContentfulLiveUpdates(embed);

  if (!liveEmbed?.sourceUrl) {
    return null;
  }

  return (
    <EmbedRenderer
      sourceUrl={liveEmbed.sourceUrl}
      title={liveEmbed.title || undefined}
      featuredImage={liveEmbed.featuredImage}
    />
  );
};
