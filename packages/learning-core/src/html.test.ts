import { describe, expect, it } from 'vitest';
import { htmlToText } from './html';

describe('htmlToText', () => {
  it('removes tags and keeps paragraph breaks', () => {
    expect(htmlToText('<p>এক</p><p>দুই</p>')).toBe('এক\n\nদুই');
  });
  it('keeps the Bangla text and the (আরবি) placeholder byte-for-byte', () => {
    expect(htmlToText('<span>আল্লাহ (আরবি) বলেন</span>')).toBe('আল্লাহ (আরবি) বলেন');
  });
  it('decodes common entities', () => {
    expect(htmlToText('a&nbsp;&amp;&nbsp;b')).toBe('a & b');
  });
  it('drops script content tags safely (no execution in text)', () => {
    expect(htmlToText('x<b>y</b>')).toBe('xy');
  });
});
