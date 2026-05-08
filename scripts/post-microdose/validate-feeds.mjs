import Parser from 'rss-parser';

const feeds = [
  'https://psychedelicalpha.com/feed/',
  'https://psychedelicstoday.com/feed',
  'https://lucid.news/feed',
  'https://dailypsychedelicvideo.com/feed',
  'https://chacruna.net/feed',
  'https://kahpi.net/feed',
  'https://psychedelicscene.com/feed',
  'https://thethirdwave.co/feed',
  'https://carolamarashi.me/feed',
  'https://jameswjesso.com/feed',
  'https://themicrodose.substack.com/feed',
  'http://feeds.feedburner.com/acs/acncdm',
  'https://maps.org/news/feed/',
  'https://www.psypost.org/exclusive/drugs/',
  'https://www.sciencedaily.com/newsfeeds.htm',
  'https://journals.sagepub.com/loi/jop',
  'https://pages.jh.edu/news_info/news/rss/',
];

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'Mozilla/5.0 (feed-validator)' },
});

const results = await Promise.all(
  feeds.map(async (url) => {
    try {
      const feed = await parser.parseURL(url);
      return {
        url,
        ok: true,
        title: feed.title || '(no title)',
        items: feed.items?.length ?? 0,
        latest: feed.items?.[0]?.title?.slice(0, 60) || '',
        latestDate: feed.items?.[0]?.isoDate || feed.items?.[0]?.pubDate || '',
      };
    } catch (e) {
      return { url, ok: false, error: String(e.message || e).slice(0, 120) };
    }
  }),
);

for (const r of results) {
  if (r.ok) {
    console.log(`✅ ${r.url}`);
    console.log(`   "${r.title}" — ${r.items} items, latest: ${r.latestDate}`);
    console.log(`   ↳ ${r.latest}`);
  } else {
    console.log(`❌ ${r.url}`);
    console.log(`   ${r.error}`);
  }
}

const okCount = results.filter((r) => r.ok).length;
console.log(`\n${okCount}/${results.length} feeds valid.`);
