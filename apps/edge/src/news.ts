export interface NewsItem { title: string; link: string; published: string | null; source: string }

export const NEWS_SOURCES: Record<string, { name: string; url: string }> = {
  bbc: { name: 'BBC Arabic', url: 'https://feeds.bbci.co.uk/arabic/rss.xml' },
  aljazeera: { name: 'Al Jazeera', url: 'https://www.aljazeera.net/aljazeerarss/a7c186be-1baa-4bd4-9d80-a84db769f779/73d0e1b4-532f-45ef-b135-bfdd219c6e1a' },
  france24: { name: 'France 24 Arabic', url: 'https://www.france24.com/ar/rss' },
};

const MAX_BYTES = 2_000_000;
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s: string) => s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (m, e: string) => {
  if (e[0] === '#') { const cp = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m; }
  return ENTITIES[e] ?? m;
});

/** Text of the first <tag> inside an item: CDATA is taken as-is, plain text has XML entities decoded. */
function field(block: string, tag: string): string {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(block);
  if (!m) return '';
  const inner = m[1]!;
  const parts = inner.split(/(<!\[CDATA\[[\s\S]*?\]\]>)/g);
  return parts.map((p) => (p.startsWith('<![CDATA[') ? p.slice(9, -3) : decode(p))).join('');
}

/** Only headline, link and date are kept. DOCTYPE/entities are refused (no entity-expansion tricks). */
export function parseNews(xml: string, source: string): NewsItem[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) return [];
  const items: NewsItem[] = [];
  const re = /<item[\s>][\s\S]*?<\/item>/g;
  for (let m = re.exec(xml); m && items.length < 25; m = re.exec(xml)) {
    const block = m[0];
    let title = field(block, 'title').replace(/<[^>]*>/g, '').trim();
    const link = field(block, 'link').trim();
    let url: URL;
    try { url = new URL(link); } catch { continue; }
    if (title.length === 0 || (url.protocol !== 'https:' && url.protocol !== 'http:')) continue;
    if (title.length > 220) title = title.slice(0, 220);
    const d = Date.parse(field(block, 'pubDate'));
    items.push({ title, link: url.toString(), published: Number.isNaN(d) ? null : new Date(d).toISOString(), source });
  }
  return items;
}

const cache = new Map<string, { at: number; items: NewsItem[] }>();
const TTL = 15 * 60_000;

/** Cached for 15 minutes; serves the last good copy if the feed is down. Only allow-listed feeds can be requested. */
export async function getNews(key: string, fetcher: typeof fetch = fetch, now = Date.now()): Promise<NewsItem[] | null> {
  const src = NEWS_SOURCES[key];
  if (!src) return null;
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL) return hit.items;
  try {
    const res = await fetcher(src.url, { headers: { 'user-agent': 'QuranShikkha/0.1 (learning app; headlines only)' } });
    if (!res.ok) throw new Error('feed');
    const text = await res.text();
    if (text.length > MAX_BYTES) return hit?.items ?? null;
    const items = parseNews(text, src.name);
    cache.set(key, { at: now, items });
    return items;
  } catch { return hit?.items ?? null; }
}
