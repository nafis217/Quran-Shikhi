import { useEffect, useRef, useState } from 'react';
import { LANGS, type Lang } from '@quran-shikkha/learning-core';
import { useSettings, type Layout, type Theme } from '../settings';

/** One place for every preference, instead of a crowded header. */
export function SettingsPanel() {
  const { t, lang, theme, showPron, wordMeanings, hoverAudio, layout, fontScale, set } = useSettings();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [open]);

  const themes: [Theme, string][] = [['light', '☀ ' + t('themeLight')], ['dark', '🌙 ' + t('themeDark')], ['auto', t('themeAuto')]];
  const layouts: [Layout, string][] = [['stacked', t('layoutStacked')], ['side', t('layoutSide')]];

  return (
    <div className="settings-wrap" ref={wrap}>
      <button className="icon-btn" aria-expanded={open} aria-haspopup="dialog" aria-label={t('settings')} title={t('settings')} onClick={() => setOpen(!open)}>⚙</button>
      {open && (
        <div className="settings-panel" role="dialog" aria-label={t('settings')}>
          <h2>{t('settings')}</h2>

          <div className="field">
            <label className="label" htmlFor="lang-select">{t('language')}</label>
            <select id="lang-select" className="lang-select" value={lang} onChange={(e) => set({ lang: e.target.value as Lang })}>
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>

          <div className="field">
            <span className="label">{t('theme')}</span>
            <div className="seg" role="group" aria-label={t('theme')}>
              {themes.map(([v, label]) => <button key={v} aria-pressed={theme === v} onClick={() => set({ theme: v })}>{label}</button>)}
            </div>
          </div>

          <div className="field">
            <span className="label">{t('layout')}</span>
            <div className="seg" role="group" aria-label={t('layout')}>
              {layouts.map(([v, label]) => <button key={v} aria-pressed={layout === v} onClick={() => set({ layout: v })}>{label}</button>)}
            </div>
          </div>

          <div className="field">
            <span className="label">{t('textSize')}</span>
            <div className="size-row">
              <button className="btn small" aria-label={t('fontSmaller')} onClick={() => set({ fontScale: Math.max(0.9, +(fontScale - 0.15).toFixed(2)) })}>A−</button>
              <input type="range" min={0.9} max={1.9} step={0.05} value={fontScale} aria-label={t('textSize')} onChange={(e) => set({ fontScale: Number(e.target.value) })} />
              <button className="btn small" aria-label={t('fontBigger')} onClick={() => set({ fontScale: Math.min(1.9, +(fontScale + 0.15).toFixed(2)) })}>A+</button>
            </div>
          </div>

          <label className="toggle"><span>{t('showPron')}</span><input type="checkbox" checked={showPron} onChange={(e) => set({ showPron: e.target.checked })} /></label>
          <label className="toggle"><span>{t('wordMeanings')}</span><input type="checkbox" checked={wordMeanings} onChange={(e) => set({ wordMeanings: e.target.checked })} /></label>
          <label className="toggle"><span>{t('hoverAudio')}</span><input type="checkbox" checked={hoverAudio} onChange={(e) => set({ hoverAudio: e.target.checked })} /></label>
        </div>
      )}
    </div>
  );
}
