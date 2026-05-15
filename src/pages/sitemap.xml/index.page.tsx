import { GetServerSideProps } from 'next';
import { getServerSideSitemap, ISitemapField } from 'next-sitemap';

import { db } from '@src/lib/db';

export const getServerSideProps: GetServerSideProps = async ctx => {
  ctx.res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');

  const base = (process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

  const rs = await db.execute(`
    SELECT slug, COALESCE(updated_at, published_at) AS lastmod
    FROM posts
    ORDER BY published_at DESC
  `);

  const fields: ISitemapField[] = [
    { loc: `${base}/`, lastmod: new Date().toISOString(), changefreq: 'hourly', priority: 1.0 },
    ...rs.rows.map(row => ({
      loc: `${base}/${row.slug as string}`,
      lastmod: new Date(row.lastmod as string).toISOString(),
      changefreq: 'weekly' as const,
      priority: 0.7,
    })),
  ];

  return getServerSideSitemap(ctx, fields);
};

const Sitemap = () => null;

export default Sitemap;
