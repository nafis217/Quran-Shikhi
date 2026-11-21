import { useEffect, useState, type ReactNode } from 'react';
import type { Ayah, Word } from '@quran-shikkha/api-client';
import { explainFinding, type Key } from '@quran-shikkha/learning-core';
import { fetchServerAsr, useLocalRecitation } from '../lib/useLocalRecitation';
import { recitationSupported, useRecitation } from '../lib/useRecitation';
import { useSettings } from '../settings';

const STATUS_LABEL: Record<string, Key> = { Correct: 'recOk', Vowel: 'recVowel', Close: 'recClose', Wrong: 'recWrong', Missing: 'recMissing' };

interface Props { ayah: Ayah; onHearWord: (w: Word) => void; onBreakWord: (w: Word) => void; toolbar?: ReactNode }

/**
 * Reading teacher. Preferred: your own computer's Quran speech model (private, understands vowel marks).
 * Fallback: the browser's recogniser (letters only). Every word is marked, with what was heard.
 */
export function RecitationPanel({ ayah, onHearWord, onBreakWord, toolbar }: Props) {
  const { t, lang } = useSettings();
  const [local, setLocal] = useState<boolean | null>(null);
  useEffect(() => { void fetchServerAsr().then(setLocal); }, []);
  const browser = useRecitation(ayah.key);
  const model = useLocalRecitation(ayah.key, () => setLocal(false));
  const r = local ? model : browser;
  const supported = local ? true : recitationSupported();
  const words = ayah.words.filter((w) => w.charType === 'word');
  const busy = r.phase === 'listening' || r.phase === 'checking';

  return (
    <section className="recite" aria-label={t('recRead')}>
      <div className="recite-bar">
        {r.phase === 'listening'
          ? <button className="btn small primary" onClick={r.stop}>⏹ {t('recStop')}</button>
          : <button className="btn small" onClick={() => void r.start()} disabled={busy || local === null || !supported}>{t('recRead')}</button>}
        {toolbar}
      </div>
      {local === false && browser.phase === 'idle' && !supported && <p className="notice" role="status">{t('recNoSupport')}</p>}
      {r.phase === 'listening' && <p className="notice" role="status"><span className="rec-dot" aria-hidden="true" /> {t('recListening')}<br /><span className="ar" lang="ar" dir="rtl">{r.heard}</span></p>}
      {r.phase === 'checking' && <p className="notice" role="status">{t('recChecking')}</p>}
      {r.phase === 'error' && r.error && <p className="notice warn" role="alert">{t(r.error)}</p>}

      {r.phase === 'done' && r.result && (
        <div className="recite-result" aria-live="polite">
          <p className="score-line"><strong>{t('recScore')}: {r.result.score}%</strong>{r.result.extraWords > 0 && <span className="meta"> · {t('recExtra')}: {r.result.extraWords}</span>}</p>
          {r.heard && local && <p className="meta">{t('recHeard')}: <span className="ar" lang="ar" dir="rtl">{r.heard}</span></p>}
          <div className="words recite-words" dir="rtl">
            {r.result.words.map((w) => {
              const word = words[w.position - 1];
              const label = t(STATUS_LABEL[w.status] ?? 'recWrong');
              return (
                <button key={w.position} className="rword" data-status={w.status} lang="ar" disabled={!word}
                  onClick={() => word && onHearWord(word)} onDoubleClick={() => word && onBreakWord(word)}
                  aria-label={`${w.expected}: ${label}${w.heard ? `. ${t('recYouSaid')} ${w.heard}` : ''}`}>
                  <span className="ar">{w.expected}</span>
                  <span className="rstatus" lang={undefined}>{label}</span>
                  {w.heard && w.status !== 'Correct' && <span className="rheard" dir="rtl" lang="ar">{t('recYouSaid')}: {w.heard}</span>}
                </button>
              );
            })}
          </div>
          {r.result.words.some((w) => w.status !== 'Correct') && (
            <>
              <h3>{t('recWhat')}</h3>
              <ul className="why">
                {r.result.words.filter((w) => w.status !== 'Correct').map((w) => (
                  <li key={w.position}>
                    <span className="ar" lang="ar" dir="rtl">{w.expected}</span>
                    {w.heard && <span className="meta"> · {t('recYouSaid')}: <span className="ar" lang="ar" dir="rtl">{w.heard}</span></span>}
                    {w.status === 'Missing' && <p>{t('recSkipped')}</p>}
                    {(w.findings ?? []).map((f, i) => <p key={i} lang={lang}>{explainFinding({ type: f.type, expected: f.expected, heard: f.heard, letter: f.letter }, lang)}</p>)}
                    {w.status !== 'Missing' && (w.findings ?? []).length === 0 && <p>{t('recTip')}</p>}
                  </li>
                ))}
              </ul>
              <p className="hint">💡 {t('recTip')}</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
