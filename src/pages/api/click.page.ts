import type { NextApiRequest, NextApiResponse } from 'next';
import { incrementClicks } from '@src/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }
  const slug = typeof req.body?.slug === 'string' ? req.body.slug : null;
  if (!slug) return res.status(400).json({ error: 'missing slug' });
  try {
    await incrementClicks(slug);
    res.status(204).end();
  } catch (err) {
    console.error('click increment failed', err);
    res.status(500).json({ error: 'increment failed' });
  }
}
