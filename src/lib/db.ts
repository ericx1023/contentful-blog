import { createClient, type Client, type InValue } from '@libsql/client';

const client: Client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? 'file:./data/posts.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = client;

export interface PostListItem {
  slug: string;
  title: string;
  subtitle: string | null;
  author_name: string | null;
  author_slug: string | null;
  published_at: string;
  featured_image_path: string | null;
  source_url: string | null;
  clicks: number;
  comments_cached: number;
  origin: 'standard' | 'rss';
}

export interface PostDetail extends PostListItem {
  id: number;
  body_html: string;
  author_avatar_path: string | null;
}

export async function listPosts(): Promise<PostListItem[]> {
  const rs = await db.execute(`
    SELECT p.slug, p.title, p.subtitle, a.name AS author_name, a.slug AS author_slug,
           p.published_at, p.featured_image_path, p.source_url,
           COALESCE(ps.clicks, 0) AS clicks,
           COALESCE(ps.comments_cached, 0) AS comments_cached,
           p.origin
    FROM posts p
    LEFT JOIN authors a ON p.author_id = a.id
    LEFT JOIN post_stats ps ON p.id = ps.post_id
    ORDER BY p.published_at DESC
  `);
  return rs.rows.map(rowToListItem);
}

export async function getPostBySlug(slug: string): Promise<PostDetail | null> {
  const rs = await db.execute({
    sql: `
      SELECT p.id, p.slug, p.title, p.subtitle, a.name AS author_name, a.slug AS author_slug,
             a.avatar_path AS author_avatar_path,
             p.published_at, p.featured_image_path, p.source_url,
             p.body_html,
             COALESCE(ps.clicks, 0) AS clicks,
             COALESCE(ps.comments_cached, 0) AS comments_cached,
             p.origin
      FROM posts p
      LEFT JOIN authors a ON p.author_id = a.id
      LEFT JOIN post_stats ps ON p.id = ps.post_id
      WHERE p.slug = ?
    `,
    args: [slug],
  });
  const row = rs.rows[0];
  if (!row) return null;
  return {
    ...rowToListItem(row),
    id: row.id as number,
    body_html: row.body_html as string,
    author_avatar_path: row.author_avatar_path as string | null,
  };
}

export async function listAllSlugs(): Promise<string[]> {
  const rs = await db.execute(`SELECT slug FROM posts ORDER BY published_at DESC`);
  return rs.rows.map(r => r.slug as string);
}

export async function incrementClicks(slug: string): Promise<void> {
  await db.execute({
    sql: `
      UPDATE post_stats SET clicks = clicks + 1
      WHERE post_id = (SELECT id FROM posts WHERE slug = ?)
    `,
    args: [slug],
  });
}

function rowToListItem(row: Record<string, InValue>): PostListItem {
  return {
    slug: row.slug as string,
    title: row.title as string,
    subtitle: (row.subtitle as string | null) ?? null,
    author_name: (row.author_name as string | null) ?? null,
    author_slug: (row.author_slug as string | null) ?? null,
    published_at: row.published_at as string,
    featured_image_path: (row.featured_image_path as string | null) ?? null,
    source_url: (row.source_url as string | null) ?? null,
    clicks: (row.clicks as number) ?? 0,
    comments_cached: (row.comments_cached as number) ?? 0,
    origin: row.origin as 'standard' | 'rss',
  };
}
