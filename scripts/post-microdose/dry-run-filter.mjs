import Parser from 'rss-parser';

const FEEDS = [
  'https://psychedelicalpha.com/feed/',
  'https://psychedelicstoday.com/feed',
  'https://lucid.news/feed',
  'https://kahpi.net/feed',
  'https://thethirdwave.co/feed',
  'https://jameswjesso.com/feed',
  'https://themicrodose.substack.com/feed',
  'https://www.psypost.org/exclusive/drugs/psychedelic-research/feed/',
  'https://www.sciencedaily.com/rss/mind_brain/psychedelic_drugs.xml',
];

const KEYWORDS = [
  'psychedelic', 'psychedelics', 'psychedelia',
  'psilocybin', 'psilocin', 'magic mushroom', 'magic mushrooms',
  'MDMA', 'ecstasy',
  'ayahuasca', 'DMT', '5-MeO-DMT', 'changa',
  'LSD',
  'ketamine', 'esketamine',
  'mescaline', 'peyote', 'huachuma', 'San Pedro',
  'ibogaine', 'iboga',
  'salvia', 'salvinorin',
  '2C-B',
  'hallucinogen', 'hallucinogens', 'hallucinogenic',
  'entheogen', 'entheogens', 'entheogenic',
  'microdose', 'microdosing',
];

const RE = new RegExp(
  '\\b(' + KEYWORDS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b',
  'i',
);

const parser = new Parser({
  timeout: 20000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept: 'application/rss+xml, application/xml, text/xml, */*',
  },
});

let kept = 0;
let skipped = 0;

for (const url of FEEDS) {
  try {
    const feed = await parser.parseURL(url);
    console.log(`\n=== ${feed.title} (${feed.items.length} items) ===`);
    for (const item of feed.items.slice(0, 10)) {
      const text = `${item.title || ''} ${item.contentSnippet || item.content || ''}`;
      const m = text.match(RE);
      if (m) {
        kept++;
        console.log(`  ✓ "${m[1]}"  ← ${item.title?.slice(0, 80)}`);
      } else {
        skipped++;
        console.log(`  ⊘         ← ${item.title?.slice(0, 80)}`);
      }
    }
  } catch (e) {
    console.log(`\n=== ${url} ===\n  ❌ ${e.message}`);
  }
}

console.log(`\n──────\nKept: ${kept}    Skipped: ${skipped}    Match rate: ${((kept / (kept + skipped)) * 100).toFixed(1)}%`);
