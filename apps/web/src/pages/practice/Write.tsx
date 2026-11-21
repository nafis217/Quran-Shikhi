import { useCallback, useEffect, useRef, useState } from 'react';
import { LETTERS, PRACTICE_WORDS, letterName } from '@quran-shikkha/learning-core';
import { useSettings } from '../../settings';
import { Back } from './Back';

type Paper = 'plain' | 'lined' | 'grid';
interface Stroke { erase: boolean; color: string; size: number; pts: [number, number][] } // points are 0..1 of the paper

const COLORS = ['#0b0b0c', '#1b6fa8', '#c0392b', '#2e8b57', '#e08a00', '#7b2cbf', '#d63384', '#6b4f2a'];
const PAPER_BG = '#fffdf6';

/** Pen width in px for a size on the 3..24 scale; follows the paper width so it looks the same on phone and desktop. */
const px = (size: number, width: number) => (size / 1000) * Math.max(width, 700);

function paint(ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number) {
  ctx.save();
  ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
  ctx.strokeStyle = ctx.fillStyle = s.erase ? '#000' : s.color;
  ctx.lineWidth = px(s.size, w) * (s.erase ? 2.5 : 1);
  ctx.lineCap = ctx.lineJoin = 'round';
  const [first, ...rest] = s.pts;
  if (!first) { ctx.restore(); return; }
  if (rest.length === 0) { ctx.beginPath(); ctx.arc(first[0] * w, first[1] * h, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); ctx.restore(); return; }
  ctx.beginPath();
  ctx.moveTo(first[0] * w, first[1] * h);
  for (let i = 0; i < rest.length - 1; i++) { // smooth curve through the midpoints
    const [x, y] = rest[i]!, [nx, ny] = rest[i + 1]!;
    ctx.quadraticCurveTo(x * w, y * h, ((x + nx) / 2) * w, ((y + ny) / 2) * h);
  }
  const last = rest[rest.length - 1]!;
  ctx.lineTo(last[0] * w, last[1] * h);
  ctx.stroke();
  ctx.restore();
}

export default function Write() {
  const { t, lang } = useSettings();
  const [paper, setPaper] = useState<Paper>('lined');
  const [erase, setErase] = useState(false);
  const [color, setColor] = useState(COLORS[1]!);
  const [size, setSize] = useState(9);
  const [guide, setGuide] = useState('');
  const [count, setCount] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const cur = useRef<Stroke | null>(null);

  const redraw = useCallback(() => {
    const c = cv.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    for (const s of strokes.current) paint(ctx, s, c.width, c.height);
  }, []);

  // keep the bitmap sharp and matching the displayed size
  useEffect(() => {
    const el = wrap.current, c = cv.current; if (!el || !c) return;
    const fit = () => {
      const r = el.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.max(1, Math.round(r.width * dpr)); c.height = Math.max(1, Math.round(r.height * dpr));
      redraw();
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, [redraw]);

  const at = (e: React.PointerEvent): [number, number] => {
    const r = cv.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    cur.current = { erase, color, size, pts: [at(e)] };
    const c = cv.current!; paint(c.getContext('2d')!, cur.current, c.width, c.height);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = cur.current; if (!s) return;
    s.pts.push(at(e));
    const c = cv.current!, ctx = c.getContext('2d')!;
    paint(ctx, { ...s, pts: s.pts.slice(-3) }, c.width, c.height); // draw only the newest segment while moving
  };
  const up = () => {
    const s = cur.current; cur.current = null;
    if (s) { strokes.current.push(s); setCount(strokes.current.length); redraw(); }
  };

  const undo = () => { strokes.current.pop(); setCount(strokes.current.length); redraw(); };
  const clear = () => { strokes.current = []; setCount(0); redraw(); };

  /** PNG with the paper and the writing (the faint guide is not included). */
  const save = () => {
    const c = cv.current!, out = document.createElement('canvas');
    out.width = c.width; out.height = c.height;
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = PAPER_BG; ctx.fillRect(0, 0, out.width, out.height);
    ctx.strokeStyle = '#9fc6e2'; ctx.lineWidth = 1;
    const step = out.width / (paper === 'grid' ? 22 : 14);
    if (paper === 'lined') for (let y = step; y < out.height; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(out.width, y); ctx.stroke(); }
    if (paper === 'grid') { for (let y = step; y < out.height; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(out.width, y); ctx.stroke(); } for (let x = step; x < out.width; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, out.height); ctx.stroke(); } }
    ctx.drawImage(c, 0, 0);
    const a = document.createElement('a');
    a.download = 'arabic-writing.png'; a.href = out.toDataURL('image/png'); a.click();
  };

  const papers: [Paper, string][] = [['plain', t('paperPlain')], ['lined', t('paperLined')], ['grid', t('paperGrid')]];

  return (
    <div>
      <Back />
      <h1>{t('pWrite')}</h1>
      <p className="hint">{t('pWriteDesc')}</p>

      <div className="paper-wrap" data-paper={paper} ref={wrap}>
        {guide && <div className="paper-guide ar" lang="ar" aria-hidden="true">{guide}</div>}
        <canvas ref={cv} className="paper-layer paper-ink" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          role="img" aria-label={t('pWrite')} />
      </div>

      <div className="tools-bar">
        <div className="row">
          <div className="seg" role="group" aria-label={t('pen') + ' / ' + t('eraser')}>
            <button aria-pressed={!erase} onClick={() => setErase(false)}>✎ {t('pen')}</button>
            <button aria-pressed={erase} onClick={() => setErase(true)}>⌫ {t('eraser')}</button>
          </div>
          <button className="btn small" onClick={undo} disabled={count === 0}>↶ {t('undo')}</button>
          <button className="btn small ghost" onClick={clear} disabled={count === 0}>{t('clear')}</button>
          <button className="btn small" onClick={save}>⬇ {t('saveImage')}</button>
        </div>

        <div className="field">
          <span className="label">{t('colour')}</span>
          <div className="swatches">
            {COLORS.map((c) => <button key={c} className="swatch" style={{ background: c }} aria-label={c} aria-pressed={!erase && color === c} onClick={() => { setColor(c); setErase(false); }} />)}
            <input type="color" value={color} aria-label={t('colour')} onChange={(e) => { setColor(e.target.value); setErase(false); }} />
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="pen-size">{t('penSize')}</label>
          <input id="pen-size" type="range" min={3} max={24} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </div>

        <div className="field">
          <span className="label">{t('paper')}</span>
          <div className="seg" role="group" aria-label={t('paper')}>{papers.map(([v, l]) => <button key={v} aria-pressed={paper === v} onClick={() => setPaper(v)}>{l}</button>)}</div>
        </div>

        <div className="field">
          <label className="label" htmlFor="guide">{t('guideShow')}</label>
          <select id="guide" className="lang-select" value={guide} onChange={(e) => setGuide(e.target.value)}>
            <option value="">{t('guideNone')}</option>
            {LETTERS.map((l) => <option key={l.id} value={l.ch}>{l.ch}  {letterName(l, lang)}</option>)}
            {PRACTICE_WORDS.map((w) => <option key={w.id} value={w.parts.map((p) => p.join('')).join(' ')}>{w.label[lang]}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
