import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LETTERS, letterName, scoreTrace, traceFeedback, type Key, type Region, type TraceFeedback, type TraceResult } from '@quran-shikkha/learning-core';
import { markTraced } from '../../lib/practiceProgress';
import { useSettings } from '../../settings';
import { Back } from './Back';

const REGION: Record<Region, Key> = { top: 'regionTop', bottom: 'regionBottom', left: 'regionLeft', right: 'regionRight', middle: 'regionMiddle' };
const SIZE = 320;
const PEN = 18;
const MARGIN = 26; // extra thickness around the glyph where ink is still acceptable
const FONT = (px: number) => `${px}px "Amiri Quran", "Scheherazade New", serif`;

/** Draws the glyph centred using its real bounding box, so tall and low letters both sit in the middle. */
function drawGlyph(ctx: CanvasRenderingContext2D, ch: string, mode: 'guide' | 'core' | 'tolerant') {
  ctx.save();
  ctx.font = FONT(210);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(ch);
  const cx = SIZE / 2 + (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2;
  const cy = SIZE / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  ctx.lineJoin = 'round';
  if (mode === 'tolerant') { ctx.lineWidth = MARGIN; ctx.strokeStyle = '#000'; ctx.strokeText(ch, cx, cy); }
  ctx.fillStyle = mode === 'guide' ? 'rgba(27,111,168,.22)' : '#000';
  ctx.fillText(ch, cx, cy);
  ctx.restore();
}

function maskOf(draw: (c: CanvasRenderingContext2D) => void): Uint8Array {
  const c = document.createElement('canvas'); c.width = c.height = SIZE;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  draw(ctx);
  const d = ctx.getImageData(0, 0, SIZE, SIZE).data;
  const out = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + 3]! > 40 ? 1 : 0;
  return out;
}

export default function Trace() {
  const { t, lang } = useSettings();
  const [params, setParams] = useSearchParams();
  const startId = params.get('letter');
  const [idx, setIdx] = useState(Math.max(0, LETTERS.findIndex((l) => l.id === startId)));
  const letter = LETTERS[idx]!;
  const guide = useRef<HTMLCanvasElement>(null);
  const ink = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const over = useRef<HTMLCanvasElement>(null);
  const [result, setResult] = useState<TraceResult | null>(null);
  const [fb, setFb] = useState<TraceFeedback | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => { void document.fonts.load(FONT(210), letter.ch).then(() => setReady(true), () => setReady(true)); }, [letter.ch]);

  const clear = useCallback(() => {
    ink.current?.getContext('2d')?.clearRect(0, 0, SIZE, SIZE);
    const g = guide.current?.getContext('2d');
    if (g) { g.clearRect(0, 0, SIZE, SIZE); drawGlyph(g, letter.ch, 'guide'); }
    over.current?.getContext('2d')?.clearRect(0, 0, SIZE, SIZE);
    setResult(null); setFb(null);
  }, [letter.ch]);
  useEffect(() => { if (ready) clear(); }, [ready, clear]);

  const pos = (e: React.PointerEvent) => {
    const r = ink.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * SIZE, y: ((e.clientY - r.top) / r.height) * SIZE };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true; setResult(null); setFb(null);
    over.current?.getContext('2d')?.clearRect(0, 0, SIZE, SIZE);
    const ctx = ink.current!.getContext('2d')!; const p = pos(e);
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(p.x, p.y, PEN / 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = ink.current!.getContext('2d')!; const p = pos(e);
    ctx.lineWidth = PEN; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#000';
    ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(p.x, p.y);
  };
  const up = () => { drawing.current = false; };

  const check = () => {
    const core = maskOf((c) => drawGlyph(c, letter.ch, 'core'));
    const tol = maskOf((c) => drawGlyph(c, letter.ch, 'tolerant'));
    const inkMask = maskOf((c) => c.drawImage(ink.current!, 0, 0));
    const r = scoreTrace(core, tol, inkMask);
    setResult(r);
    const f = traceFeedback(core, tol, inkMask, SIZE);
    setFb(f);
    // Heatmap: red = part of the letter you missed, orange = ink outside the letter.
    const octx = over.current!.getContext('2d')!;
    const img = octx.createImageData(SIZE, SIZE);
    for (let i = 0; i < f.overlay.length; i++) {
      const v = f.overlay[i]!;
      if (v === 0) continue;
      img.data.set(v === 1 ? [220, 38, 38, 150] : [245, 140, 20, 190], i * 4);
    }
    octx.putImageData(img, 0, 0);
    if (r.pass) markTraced(letter.id);
  };

  const go = (d: number) => { const n = (idx + d + LETTERS.length) % LETTERS.length; setIdx(n); setParams({ letter: LETTERS[n]!.id }, { replace: true }); setReady(false); setResult(null); };

  return (
    <div>
      <Back />
      <h1>{t('pTrace')}</h1>
      <p className="hint">{t('traceHint')}</p>
      <div className="row">
        <button className="btn small" onClick={() => go(-1)}>← {t('prev')}</button>
        <strong className="trace-name">{letterName(letter, lang)} · <span className="ar" lang="ar">{letter.ar}</span></strong>
        <button className="btn small" onClick={() => go(1)}>{t('next')} →</button>
      </div>
      <div className="trace-wrap" style={{ aspectRatio: '1 / 1' }}>
        <canvas ref={guide} width={SIZE} height={SIZE} className="trace-layer" aria-hidden="true" />
        <canvas ref={over} width={SIZE} height={SIZE} className="trace-layer trace-over" aria-hidden="true" />
        <canvas ref={ink} width={SIZE} height={SIZE} className="trace-layer trace-ink" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          role="img" aria-label={`${t('pTrace')}: ${letterName(letter, lang)}`} />
      </div>
      <div className="row">
        <button className="btn" onClick={clear}>{t('clear')}</button>
        <button className="btn primary" onClick={check}>{t('check')}</button>
      </div>
      {result && fb && (fb.missed || fb.stray) && (
        <ul className="hints" role="status">
          {fb.missed && <li>🔴 {t('traceMissed').replace('%s', t(REGION[fb.missed]))}</li>}
          {fb.stray && <li>🟠 {t('traceStray').replace('%s', t(REGION[fb.stray]))}</li>}
          <li className="meta">{t('traceLegend')}</li>
        </ul>
      )}
      {result && (
        <p className={result.pass ? 'notice good' : 'notice warn'} role="status">
          {result.pass ? '⭐ ' + t('traceGood') : t('traceTry')} · {t('traceScore')}: {result.score}%
        </p>
      )}
    </div>
  );
}
