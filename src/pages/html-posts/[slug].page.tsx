import { useContentfulLiveUpdates } from '@contentful/live-preview/react';
import { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from 'next';
import { useTranslation } from 'next-i18next';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

import { getServerSideTranslations } from '../utils/get-serverside-translations';

import { Container } from '@src/components/shared/container';
import { FormatDate } from '@src/components/shared/format-date';
import { CtfEmbed } from '@src/components/features/contentful/CtfEmbed';
import { client, previewClient } from '@src/lib/client';
import { revalidateDuration } from '@src/pages/utils/constants';

const Page = (props: InferGetStaticPropsType<typeof getStaticProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const post = useContentfulLiveUpdates(props.post);

  if (!post) return null;

  // 獲取發布日期（從系統字段）
  const publishedDate = post.sys.publishedAt || post.sys.firstPublishedAt;

  return (
    <>
      <Head>
        <title>{post.title} | 迷幻矽谷</title>
        <meta name="description" content={post.internalName || ''} />
      </Head>

      <Container className="my-8">
        <div className="mb-4 flex items-center justify-between">
          <span className="bg-blue-100 text-blue-800 rounded px-2 py-1 text-xs font-medium">
            Markdown 文章
          </span>
          {publishedDate && (
            <time className="text-gray-500 text-sm" dateTime={publishedDate}>
              <FormatDate date={new Date(publishedDate)} />
            </time>
          )}
        </div>
      </Container>

      <Container className="max-w-4xl">
        {post.featuredImage && (
          <div className="mb-8">
            <Image
              src={post.featuredImage.url}
              width={post.featuredImage.width || 1200}
              height={post.featuredImage.height || 630}
              alt={post.title || '文章特色圖片'}
              className="w-full rounded-lg"
            />
          </div>
        )}

        <h1 className="mb-6 text-4xl font-bold">{post.title}</h1>

        {post.author && (
          <div className="mb-6 flex items-center">
            {post.author.avatar && (
              <Image
                src={post.author.avatar.url}
                width={40}
                height={40}
                alt={post.author.name || '作者頭像'}
                className="mr-3 rounded-full"
              />
            )}
            <span className="font-medium">{post.author.name}</span>
          </div>
        )}

        {post.internalName && <div className="text-gray-600 mb-8 text-xl">{post.internalName}</div>}
        <div className="border-gray-200 prose prose-lg max-w-none border-t pt-8">
          <ReactMarkdown rehypePlugins={[rehypeRaw]} remarkPlugins={[remarkGfm]}>
            {post.html || ''}
          </ReactMarkdown>

          {/* Rich Embed - Check if sourceUrl exists in post data */}
          {post.sourceUrl && (
            <div className="border-gray-200 mt-8 border-t pt-6">
              <CtfEmbed embed={post} />
            </div>
          )}
        </div>
      </Container>

      <Container className="my-12 max-w-4xl">
        <button
          onClick={() => router.back()}
          className="bg-blue-600 hover:bg-blue-700 mt-8 rounded-md px-4 py-2 text-white"
        >
          ← {t('common.backToList')}
        </button>
      </Container>
    </>
  );
};

export const getStaticProps: GetStaticProps = async ({ params, locale, draftMode: preview }) => {
  if (!params?.slug || !locale) {
    return {
      notFound: true,
      revalidate: revalidateDuration,
    };
  }

  const gqlClient = preview ? previewClient : client;

  try {
    const postData = await gqlClient.pageBlogPostWithHtml({
      slug: params.slug.toString(),
      locale,
      preview,
    });

    const post = postData.pageBlogPostWithHtmlCollection?.items[0];

    if (!post) {
      return {
        notFound: true,
        revalidate: revalidateDuration,
      };
    }

    return {
      revalidate: revalidateDuration,
      props: {
        ...(await getServerSideTranslations(locale)),
        previewActive: !!preview,
        post,
      },
    };
  } catch (error) {
    return {
      notFound: true,
      revalidate: revalidateDuration,
    };
  }
};

export const getStaticPaths: GetStaticPaths = async ({ locales }) => {
  // 由於 SDK 尚未包含我們需要的方法，這裡我們返回空路徑，讓 Next.js 在請求時生成頁面
  return {
    paths: [],
    fallback: 'blocking',
  };
};

export default Page;
