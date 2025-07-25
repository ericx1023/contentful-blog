import { useContentfulLiveUpdates } from '@contentful/live-preview/react';
import { GetStaticProps, InferGetStaticPropsType } from 'next';
import { useTranslation } from 'next-i18next';
import Link from 'next/link';
import Image from 'next/image';
import Head from 'next/head';

import { getServerSideTranslations } from '../utils/get-serverside-translations';

import { SeoFields } from '@src/components/features/seo';
import { Container } from '@src/components/shared/container';
import { PageBlogPostWithHtmlOrder } from '@src/lib/__generated/sdk';
import { client, previewClient } from '@src/lib/client';
import { revalidateDuration } from '@src/pages/utils/constants';

const Page = (props: InferGetStaticPropsType<typeof getStaticProps>) => {
  const { t } = useTranslation();
  const posts = useContentfulLiveUpdates(props.posts);

  if (!posts) return null;

  return (
    <>
      <Head>
        <title>Markdown 部落格文章 | {t('common.homepage')}</title>
        <meta name="description" content="使用 Markdown 撰寫的部落格文章列表" />
      </Head>

      <Container>
        <h1 className="mb-8 text-3xl font-bold">Markdown 部落格文章</h1>
      </Container>

      <Container className="my-8 md:mb-10 lg:mb-16">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map(post => (
            <Link key={post.sys.id} href={`/html-posts/${post.slug}`} className="block">
              <div className="border-gray-200 h-full rounded-lg border p-6 transition-shadow hover:shadow-md">
                {post.featuredImage && (
                  <div className="mb-4 overflow-hidden rounded-lg">
                    <Image
                      src={post.featuredImage.url}
                      width={post.featuredImage.width || 600}
                      height={post.featuredImage.height || 400}
                      alt={post.title || '文章圖片'}
                      className="w-full object-cover"
                      style={{ maxHeight: '200px' }}
                    />
                  </div>
                )}
                <h2 className="mb-3 text-xl font-semibold">{post.title}</h2>
                <div className="text-gray-500 mb-4 text-sm">{post.internalName}</div>

                {post.author && (
                  <div className="mt-4 flex items-center">
                    {post.author.avatar && (
                      <Image
                        src={post.author.avatar.url}
                        width={24}
                        height={24}
                        alt={post.author.name || '作者頭像'}
                        className="mr-2 rounded-full"
                      />
                    )}
                    <span className="text-gray-600 text-xs">{post.author.name}</span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </>
  );
};

export const getStaticProps: GetStaticProps = async ({ locale, draftMode: preview }) => {
  try {
    const gqlClient = preview ? previewClient : client;

    const blogPostsData = await gqlClient.pageBlogPostWithHtmlCollection({
      limit: 20,
      locale,
      order: PageBlogPostWithHtmlOrder.TitleAsc,
      preview,
    });
    const posts = blogPostsData.pageBlogPostWithHtmlCollection?.items;

    if (!posts || posts.length === 0) {
      return {
        revalidate: revalidateDuration,
        notFound: true,
      };
    }

    return {
      revalidate: revalidateDuration,
      props: {
        previewActive: !!preview,
        ...(await getServerSideTranslations(locale)),
        posts,
      },
    };
  } catch {
    return {
      revalidate: revalidateDuration,
      notFound: true,
    };
  }
};

export default Page;
