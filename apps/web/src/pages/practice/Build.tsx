import { useMemo, useState } from 'react';
import { PRACTICE_WORDS, isBuilt, joinedForm, newBuild, tapTile } from '@quran-shikkha/learning-core';
import { useSettings } from '../../settings';
import { Back } from './Back';

export default function Build() {
  const { t, lang } = useSettings();
  const [wi, setWi] = useState(0);
  const word = PRACTICE_WORDS[wi]!;
  const [state, setState] = useState(() => newBuild(word));
  const placed = useMemo(() => state.target.slice(0, state.placed), [state]);
  const done = isBuilt(state);
  const go = (d: number) => { const n = (wi + d + PRACTICE_WORDS.length) % PRACTICE_WORDS.length; setWi(n); setState(newBuild(PRACTICE_WORDS[n]!)); };

  return (
    <div>
      <Back />
      <h1>{t('pBuild')}</h1>
      <div className="row">
        <button className="btn small" onClick={() => go(-1)}>← {t('prev')}</button>
        <strong>{t('tryWord')}: {word.label[lang]}</strong>
        <button className="btn small" onClick={() => go(1)}>{t('next')} →</button>
      </div>
      <p className="hint">{t('buildPrompt')}</p>
      <section className="card">
        <div className="built" dir="rtl" lang="ar" aria-live="polite" aria-label={placed.join(' ')}>
          {state.target.map((_, i) => <span key={i} className="slot ar big" data-filled={i < placed.length || undefined}>{placed[i] ?? ''}</span>)}
        </div>
        <div className="tiles" dir="rtl">
          {state.tiles.map((tile) => (
            <button key={tile.id} className="tile ar big" lang="ar" disabled={tile.used} onClick={() => setState((s) => tapTile(s, tile.id))}>{tile.ch}</button>
          ))}
        </div>
        {done && (
          <div role="status" className="notice good">
            🎉 {t('correct')} · {t('builtJoined')}:
            <div className="ar huge" lang="ar" dir="rtl">{joinedForm(word)}</div>
            <div className="ar big" lang="ar" dir="rtl">{word.display}</div>
          </div>
        )}
        <div className="row"><button className="btn" onClick={() => setState(newBuild(word))}>{t('reset')}</button></div>
      </section>
    </div>
  );
}
