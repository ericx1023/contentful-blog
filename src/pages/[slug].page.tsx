import { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from 'next';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';

import { Comments } from '@src/components/shared/Comments';
import { Container } from '@src/components/shared/container';
import { getPostBySlug, listAllSlugs, type PostDetail } from '@src/lib/db';

const REVALIDATE_SECONDS = 60;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function sourceDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

const Page = ({ post }: InferGetStaticPropsType<typeof getStaticProps>) => {
  // Fire-and-forget click increment.
  useEffect(() => {
    if (!post?.slug) return;
    // Fire-and-forget — a missed click increment is fine.
    fetch('/api/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: post.slug }),
      keepalive: true,
    }).catch(() => undefined);
  }, [post?.slug]);

  if (!post) return null;

  const domain = sourceDomain(post.source_url);

  return (
    <>
      <Head>
        <title>{post.title}</title>
        {post.subtitle && <meta name="description" content={post.subtitle} />}
      </Head>

      <Container className="my-6 max-w-3xl">
        <Link href="/" className="text-gray-500 dark:text-gray-400 text-sm hover:underline">
          ← 回首頁
        </Link>

        <article className="mt-4">
          <header className="mb-6">
            <h1 className="text-2xl font-bold leading-tight md:text-3xl">{post.title}</h1>
            {post.subtitle && (
              <p className="text-gray-600 dark:text-gray-400 mt-2 text-base">{post.subtitle}</p>
            )}
            <div className="text-gray-500 dark:text-gray-400 mt-3 text-sm">
              {post.author_name ? `by ${post.author_name}` : 'RSS'}
              {' · '}
              {formatDate(post.published_at)}
              {domain && post.source_url && (
                <>
                  {' · '}
                  <a
                    href={post.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    原文 ({domain})
                  </a>
                </>
              )}
            </div>
          </header>

          {post.featured_image_path && (
            <div className="relative mb-6 aspect-video w-full overflow-hidden rounded">
              <Image
                src={post.featured_image_path}
                alt={post.title}
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-cover"
                priority
              />
            </div>
          )}

          <div
            className="prose prose-sm max-w-none dark:prose-invert md:prose-base"
            dangerouslySetInnerHTML={{ __html: post.body_html }}
          />
        </article>

        <Comments title="留言討論" className="mt-12" />
      </Container>
    </>
  );
};

export const getStaticProps: GetStaticProps<
  { post: PostDetail | null },
  { slug: string }
> = async ({ params }) => {
  if (!params?.slug) return { notFound: true, revalidate: REVALIDATE_SECONDS };
  const post = await getPostBySlug(params.slug);
  if (!post) return { notFound: true, revalidate: REVALIDATE_SECONDS };
  return { props: { post }, revalidate: REVALIDATE_SECONDS };
};

export const getStaticPaths: GetStaticPaths = async () => {
  const slugs = await listAllSlugs();
  return {
    paths: slugs.map(slug => ({ params: { slug } })),
    fallback: 'blocking',
  };
};

export default Page;
