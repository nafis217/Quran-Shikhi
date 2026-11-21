import { describe, expect, it } from 'vitest';
import { addPage, deletePage, exportNotebook, goTo, importNotebook, MAX_PAGES, newNotebook, sanitizeNotebook, updatePage, type InkStroke } from './notebook';

const stroke: InkStroke = { erase: false, color: '#1b6fa8', size: 9, pts: [[0.1, 0.2], [0.3, 0.4]] };

describe('notebook', () => {
  it('starts with one blank page', () => {
    const nb = newNotebook();
    expect(nb.pages).toHaveLength(1);
    expect(nb.pages[0]!.strokes).toEqual([]);
  });
  it('adds a page after the current one and opens it, keeping the paper type', () => {
    let nb = updatePage(newNotebook(), { paper: 'grid' });
    nb = addPage(nb); nb = addPage(goTo(nb, 0));
    expect(nb.pages).toHaveLength(3);
    expect(nb.current).toBe(1);
    expect(nb.pages[1]!.paper).toBe('grid');
    expect(new Set(nb.pages.map((p) => p.id)).size).toBe(3);
  });
  it('stops at the page limit', () => {
    let nb = newNotebook();
    for (let i = 0; i < MAX_PAGES + 5; i++) nb = addPage(nb);
    expect(nb.pages).toHaveLength(MAX_PAGES);
  });
  it('deleting keeps neighbours and a valid current page', () => {
    let nb = addPage(addPage(newNotebook()));
    nb = updatePage(goTo(nb, 1), { strokes: [stroke] });
    const keep = nb.pages.filter((_, i) => i !== 1).map((p) => p.id);
    const after = deletePage(nb);
    expect(after.pages.map((p) => p.id)).toEqual(keep);
    expect(after.current).toBe(1);
    expect(deletePage(goTo(after, 1)).current).toBe(0);
  });
  it('deleting the only page leaves one blank page', () => {
    const nb = deletePage(updatePage(newNotebook(), { strokes: [stroke] }));
    expect(nb.pages).toHaveLength(1);
    expect(nb.pages[0]!.strokes).toEqual([]);
  });
  it('goTo clamps', () => {
    const nb = addPage(newNotebook());
    expect(goTo(nb, 99).current).toBe(1);
    expect(goTo(nb, -3).current).toBe(0);
  });
  it('sanitize survives garbage', () => {
    for (const bad of [null, undefined, 5, 'x', [], {}, { pages: 'no' }, { pages: [null, 3, { strokes: 'x' }] }]) {
      const nb = sanitizeNotebook(bad);
      expect(nb.pages.length).toBeGreaterThanOrEqual(1);
      expect(nb.current).toBeGreaterThanOrEqual(0);
    }
  });
  it('sanitize drops bad strokes, fixes colours and caps sizes', () => {
    const nb = sanitizeNotebook({ pages: [{ id: 'a', paper: 'weird', strokes: [{ ...stroke, color: 'url(x)', size: 9999 }, { erase: false, size: 3, pts: [['x', 1]] }, { ...stroke, pts: [[0, 0], [NaN, 1]] }] }], current: 7 });
    const p = nb.pages[0]!;
    expect(p.paper).toBe('lined');
    expect(p.strokes).toHaveLength(2);
    expect(p.strokes[0]!.color).toBe('#0b0b0c');
    expect(p.strokes[0]!.size).toBe(60);
    expect(p.strokes[1]!.pts).toHaveLength(1);
    expect(nb.current).toBe(0);
  });
  it('round-trips through a backup file', () => {
    const nb = updatePage(addPage(newNotebook()), { strokes: [stroke] });
    expect(importNotebook(exportNotebook(nb))).toEqual(nb);
  });
  it('rejects files that are not ours', () => {
    expect(importNotebook('not json')).toBeNull();
    expect(importNotebook('{"hello":1}')).toBeNull();
    expect(importNotebook('{"app":"other","notebook":{}}')).toBeNull();
  });
});
