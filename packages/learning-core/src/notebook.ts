/** A handwriting notebook: several pages, each a list of pen strokes. Pure data + pure functions, so it is easy to test and to back up. */
export type PaperKind = 'plain' | 'lined' | 'grid';
export interface InkStroke { erase: boolean; color: string; size: number; pts: [number, number][] } // points are 0..1 of the paper
export interface NotePage { id: string; paper: PaperKind; strokes: InkStroke[]; updated: string }
export interface Notebook { pages: NotePage[]; current: number }

export const MAX_PAGES = 50;
export const MAX_STROKES = 2000;
export const MAX_POINTS = 4000;

let counter = 0;
const newId = (): string => `p${Date.now().toString(36)}${(counter++).toString(36)}`;
export const blankPage = (paper: PaperKind = 'lined', now: Date = new Date()): NotePage => ({ id: newId(), paper, strokes: [], updated: now.toISOString() });
export const newNotebook = (): Notebook => ({ pages: [blankPage()], current: 0 });

const clampIndex = (nb: Notebook, i: number) => Math.max(0, Math.min(nb.pages.length - 1, i));
export const goTo = (nb: Notebook, i: number): Notebook => ({ ...nb, current: clampIndex(nb, i) });

/** Adds a blank page right after the current one and opens it. Refuses past MAX_PAGES. */
export function addPage(nb: Notebook, now: Date = new Date()): Notebook {
  if (nb.pages.length >= MAX_PAGES) return nb;
  const at = nb.current + 1, paper = nb.pages[nb.current]?.paper ?? 'lined';
  const pages = [...nb.pages.slice(0, at), blankPage(paper, now), ...nb.pages.slice(at)];
  return { pages, current: at };
}

/** Deletes the current page. The notebook always keeps at least one page, so deleting the last one leaves a blank page. */
export function deletePage(nb: Notebook, now: Date = new Date()): Notebook {
  if (nb.pages.length <= 1) return { pages: [blankPage(nb.pages[0]?.paper ?? 'lined', now)], current: 0 };
  const pages = nb.pages.filter((_, i) => i !== nb.current);
  return { pages, current: clampIndex({ pages, current: 0 }, nb.current) };
}

/** Replaces the current page's content (strokes / paper) and stamps the time. */
export function updatePage(nb: Notebook, patch: Partial<Pick<NotePage, 'paper' | 'strokes'>>, now: Date = new Date()): Notebook {
  const pages = nb.pages.map((p, i) => (i === nb.current ? { ...p, ...patch, updated: now.toISOString() } : p));
  return { ...nb, pages };
}

const isColor = (c: unknown): c is string => typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c);
const isPaper = (p: unknown): p is PaperKind => p === 'plain' || p === 'lined' || p === 'grid';

/** Makes anything read from storage or from an imported file safe: wrong shapes are dropped, sizes are capped. Never throws. */
export function sanitizeNotebook(raw: unknown): Notebook {
  const src = (raw ?? {}) as { pages?: unknown; current?: unknown };
  const pages: NotePage[] = [];
  if (Array.isArray(src.pages)) {
    for (const p of src.pages.slice(0, MAX_PAGES)) {
      if (!p || typeof p !== 'object') continue;
      const o = p as Record<string, unknown>;
      const strokes: InkStroke[] = [];
      if (Array.isArray(o.strokes)) {
        for (const s of o.strokes.slice(0, MAX_STROKES)) {
          if (!s || typeof s !== 'object') continue;
          const k = s as Record<string, unknown>;
          if (!Array.isArray(k.pts) || typeof k.size !== 'number' || !isFinite(k.size)) continue;
          const pts: [number, number][] = [];
          for (const q of k.pts.slice(0, MAX_POINTS)) {
            if (Array.isArray(q) && typeof q[0] === 'number' && typeof q[1] === 'number' && isFinite(q[0]) && isFinite(q[1])) pts.push([q[0], q[1]]);
          }
          if (pts.length === 0) continue;
          const erase = k.erase === true;
          strokes.push({ erase, color: isColor(k.color) ? k.color : '#0b0b0c', size: Math.max(1, Math.min(60, k.size)), pts });
        }
      }
      pages.push({
        id: typeof o.id === 'string' && /^[\w-]{1,40}$/.test(o.id) ? o.id : newId(),
        paper: isPaper(o.paper) ? o.paper : 'lined',
        strokes,
        updated: typeof o.updated === 'string' && !isNaN(Date.parse(o.updated)) ? o.updated : new Date(0).toISOString(),
      });
    }
  }
  if (pages.length === 0) return newNotebook();
  const cur = typeof src.current === 'number' && Number.isInteger(src.current) ? src.current : 0;
  return { pages, current: Math.max(0, Math.min(pages.length - 1, cur)) };
}

/** Backup file text. Contains only the drawings. */
export const exportNotebook = (nb: Notebook): string => JSON.stringify({ app: 'quran-shikkha-notebook', version: 1, notebook: nb });

/** Reads a backup file. Returns null when it is not one of ours. */
export function importNotebook(text: string): Notebook | null {
  if (text.length > 20_000_000) return null;
  try {
    const j = JSON.parse(text) as { app?: unknown; notebook?: unknown };
    if (j.app !== 'quran-shikkha-notebook' || !j.notebook) return null;
    return sanitizeNotebook(j.notebook);
  } catch { return null; }
}
