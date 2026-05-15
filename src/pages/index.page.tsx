import { GetStaticProps, InferGetStaticPropsType } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import { listPosts, type PostListItem } from '@src/lib/db';
import { Container } from '@src/components/shared/container';

const REVALIDATE_SECONDS = 60;

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return minutes <= 1 ? '剛剛' : `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} 個月前`;
  return `${Math.floor(months / 12)} 年前`;
}

function sourceDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

const Page = ({ posts }: InferGetStaticPropsType<typeof getStaticProps>) => {
  return (
    <>
      <Head>
        <title>Psyche Valley</title>
        <meta name="description" content="啟靈藥相關文章與筆記" />
      </Head>
      <Container className="my-6">
        <ol className="space-y-3">
          {posts.map((post, i) => {
            const domain = sourceDomain(post.source_url);
            return (
              <li key={post.slug} className="flex gap-3">
                <span className="text-gray-400 dark:text-gray-500 w-8 shrink-0 text-right text-sm tabular-nums">
                  {i + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <Link href={`/${post.slug}`} className="text-base font-medium hover:underline">
                      {post.title}
                    </Link>
                    {domain && (
                      <span className="text-gray-500 dark:text-gray-400 text-xs">({domain})</span>
                    )}
                  </div>
                  {post.subtitle && (
                    <p className="line-clamp-1 text-gray-600 dark:text-gray-400 mt-0.5 text-sm">
                      {post.subtitle}
                    </p>
                  )}
                  <div className="text-gray-500 dark:text-gray-400 mt-1 text-xs">
                    {post.clicks} 點擊
                    {' · '}
                    {post.author_name ? `by ${post.author_name}` : 'RSS'}
                    {' · '}
                    {timeAgo(post.published_at)}
                    {' · '}
                    {post.comments_cached} 留言
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </Container>
    </>
  );
};

export const getStaticProps: GetStaticProps<{ posts: PostListItem[] }> = async () => {
  const posts = await listPosts();
  return {
    revalidate: REVALIDATE_SECONDS,
    props: { posts },
  };
};

export default Page;
