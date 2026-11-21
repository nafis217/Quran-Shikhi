import { useEffect, useState } from 'react';
import { isMatch, makeMatch, type MatchCard } from '@quran-shikkha/learning-core';
import { useSettings } from '../../settings';
import { Back } from './Back';

export default function Match() {
  const { t, lang } = useSettings();
  const [cards, setCards] = useState<MatchCard[]>(() => makeMatch(6, lang));
  const [open, setOpen] = useState<MatchCard[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);
  const won = done.size === cards.length / 2;

  useEffect(() => () => undefined, []);
  const restart = () => { setCards(makeMatch(6, lang)); setOpen([]); setDone(new Set()); setMoves(0); };
  useEffect(restart, [lang]); // names change with the language

  const tap = (c: MatchCard) => {
    if (done.has(c.pairId) || open.some((o) => o.key === c.key) || open.length === 2) return;
    const next = [...open, c];
    setOpen(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      if (isMatch(next[0]!, next[1]!)) { setDone((d) => new Set(d).add(c.pairId)); setOpen([]); }
      else setTimeout(() => setOpen([]), 800);
    }
  };

  return (
    <div>
      <Back />
      <h1>{t('pMatch')}</h1>
      <p className="meta">{moves} · {done.size} / {cards.length / 2}</p>
      <div className="match-grid">
        {cards.map((c) => {
          const shown = done.has(c.pairId) || open.some((o) => o.key === c.key);
          return (
            <button key={c.key} className="match-card" data-open={shown || undefined} data-done={done.has(c.pairId) || undefined}
              onClick={() => tap(c)} aria-label={shown ? c.text : '?'}>
              {shown ? <span className={c.kind === 'letter' ? 'ar big' : ''} lang={c.kind === 'letter' ? 'ar' : lang}>{c.text}</span> : '?'}
            </button>
          );
        })}
      </div>
      <p role="status" aria-live="polite" className="notice-line">{won ? '🎉 ' + t('allMatched') : ''}</p>
      <button className="btn" onClick={restart}>{t('newRound')}</button>
    </div>
  );
}
