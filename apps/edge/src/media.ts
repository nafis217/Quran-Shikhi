import raw from '../../../backend/src/QuranShikkha.Api/Content/media.json' with { type: 'json' };

export interface MediaItem { id: string; platform: string; videoId: string; title: string; channel: string; age: string; topic: string }
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const AGES = new Set(['kids', 'adults']);

/** Entries are validated so a typo cannot inject anything other than a plain YouTube video id. */
export function parseMedia(json: unknown): MediaItem[] {
  const items = (json as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  const list: MediaItem[] = [];
  for (const e of items) {
    const s = (n: string): string => (typeof (e as Record<string, unknown>)?.[n] === 'string' ? ((e as Record<string, string>)[n] as string) : '');
    const item = { id: s('id'), platform: s('platform'), videoId: s('videoId'), title: s('title'), channel: s('channel'), age: s('age'), topic: s('topic') };
    if (item.platform === 'youtube' && VIDEO_ID.test(item.videoId) && AGES.has(item.age) && item.title.length > 0 && item.title.length <= 300)
      list.push({ ...item, title: item.title.trim(), channel: item.channel.trim() });
  }
  return list;
}

export const MEDIA: MediaItem[] = parseMedia(raw);
