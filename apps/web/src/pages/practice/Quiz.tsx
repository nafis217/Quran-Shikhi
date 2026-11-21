import { useState } from 'react';
import { isCorrect, letterName, makeQuestion, type Letter, type QuizMode } from '@quran-shikkha/learning-core';
import { setQuizBest } from '../../lib/practiceProgress';
import { useSettings } from '../../settings';
import { Back } from './Back';

export default function Quiz() {
  const { t, lang } = useSettings();
  const [mode, setMode] = useState<QuizMode>('letter-to-name');
  const [q, setQ] = useState(() => makeQuestion('letter-to-name', lang));
  const [picked, setPicked] = useState<Letter | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });

  const next = (m = mode) => { setQ(makeQuestion(m, lang)); setPicked(null); };
  const pick = (l: Letter) => {
    if (picked) return;
    setPicked(l);
    const right = isCorrect(q, l) ? score.right + 1 : score.right;
    setScore({ right, total: score.total + 1 });
    setQuizBest(right);
  };
  const setM = (m: QuizMode) => { setMode(m); setScore({ right: 0, total: 0 }); next(m); };

  return (
    <div>
      <Back />
      <h1>{t('pQuiz')}</h1>
      <div className="row" role="group">
        <button className="btn small" aria-pressed={mode === 'letter-to-name'} data-on={mode === 'letter-to-name' || undefined} onClick={() => setM('letter-to-name')}>{t('modeLetterName')}</button>
        <button className="btn small" aria-pressed={mode === 'name-to-letter'} data-on={mode === 'name-to-letter' || undefined} onClick={() => setM('name-to-letter')}>{t('modeNameLetter')}</button>
        <span className="meta">{t('score')}: {score.right} / {score.total}</span>
      </div>
      <section className="card quiz">
        {mode === 'letter-to-name'
          ? <div className="ar huge" lang="ar" aria-label={q.target.ar}>{q.target.ch}</div>
          : <div className="chip-pron big-name">{letterName(q.target, lang)}</div>}
        <div className="options">
          {q.options.map((o) => {
            const state = picked ? (isCorrect(q, o) ? 'right' : picked.id === o.id ? 'wrong' : undefined) : undefined;
            return (
              <button key={o.id} className="btn option" data-state={state} disabled={!!picked && !state} onClick={() => pick(o)}>
                {mode === 'letter-to-name' ? letterName(o, lang) : <span className="ar big" lang="ar">{o.ch}</span>}
              </button>
            );
          })}
        </div>
        <p role="status" aria-live="polite" className="notice-line">{picked ? (isCorrect(q, picked) ? '✅ ' + t('correct') : '❌ ' + t('wrong') + ' — ' + (mode === 'letter-to-name' ? letterName(q.target, lang) : q.target.ch)) : ''}</p>
        {picked && <button className="btn primary" onClick={() => next()}>{t('next')} →</button>}
      </section>
    </div>
  );
}
