import { useState } from 'react';
import type { Ayah, Word } from '@quran-shikkha/api-client';
import { LANGS, dirOf } from '@quran-shikkha/learning-core';
import { api } from '../lib/api';
import { playUrl, wordAudioUrl } from '../lib/audio';
import { useSettings } from '../settings';
import type { Breakdown } from '../lib/useWordInteraction';
import { WordButton } from './WordButton';
import { WordChip } from './WordChip';
import { RecitationPanel } from './RecitationPanel';

export type Step = 'listen' | 'tap' | 'break' | 'meaning' | 'read';
const STEPS: Step[] = ['listen', 'tap', 'break', 'meaning', 'read'];

interface Props {
  ayah: Ayah;
  translation: { text: string; source: string } | null;
  selected: Word | null;
  breakdown: Breakdown | null;
  notice: string;
  steps: Set<Step>;
  completed: boolean;
  onStep: (s: Step) => void;
  onComplete: () => void;
  onTap: (w: Word) => void;
  onBreak: (w: Word) => void;
  onListen: (w: Word) => void;
  onHover: (w: Word) => void;
  onClose: () => void;
  onDetails: () => void;
}

/**
 * One ayah. Arabic (right-to-left) and its meaning (left-to-right, or right-to-left for Arabic UI) live in two separate zones,
 * each aligned to its own starting edge with a small label there, so mixed directions never get tangled.
 */
export function AyahBlock(p: Props) {
  const { t, lang, layout, wordMeanings } = useSettings();
  const [readMode, setReadMode] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [audioMsg, setAudioMsg] = useState('');
  const words = p.ayah.words.filter((w) => w.charType === 'word');
  const chipWord = p.selected && p.selected.key.startsWith(p.ayah.key + ':') ? p.selected : null;
  const hide = readMode && !revealed;
  // Arabic UI shows the simple Arabic tafsir (Muyassar) as the meaning, so its label says so rather than repeating "Arabic".
  const langLabel = lang === 'ar' ? t('tafsir') : LANGS.find((l) => l.code === lang)!.label;

  const playAyah = async () => {
    p.onStep('listen');
    setAudioMsg('');
    try {
      const r = await api.GET('/api/v1/ayahs/{surah}:{ayah}/details', { params: { path: { surah: p.ayah.surah, ayah: p.ayah.ayah } } });
      const url = wordAudioUrl(r.data?.audioUrl);
      if (!url || !(await playUrl(url)).ok) setAudioMsg(t('noAudio'));
    } catch { setAudioMsg(t('errorBody')); }
  };

  return (
    <article className="ayah" id={`a${p.ayah.ayah}`} aria-label={`${t('ayah')} ${p.ayah.ayah}`} data-complete={p.completed || undefined}>
      <header className="ayah-head">
        <span className="num" aria-hidden="true">{p.ayah.ayah}</span>
        <span className="sr-only">{t('ayah')} {p.ayah.ayah}{p.completed ? ' ✓' : ''}</span>
        <span className="dots" role="img" aria-label={`${t('ladder')}: ${p.steps.size}/5`}>
          {STEPS.map((s) => <i key={s} data-done={p.steps.has(s) || undefined} />)}
        </span>
        <span className="ayah-actions">
          <button className="btn small" onClick={() => void playAyah()}>▶ {t('playAyah')}</button>
          <button className="btn small" onClick={p.onDetails}>📖 {t('details')}</button>
        </span>
      </header>

      <div className="ayah-body" data-layout={layout}>
        <div className="zone zone-ar" dir="rtl" lang="ar">
          <span className="zone-tag" aria-hidden="true">العربية</span>
          <div className="words">
            {words.map((w) => (
              <WordButton
                key={w.key}
                word={w}
                selected={p.selected?.key === w.key}
                breakdown={p.breakdown}
                showPron={hide ? false : undefined}
                showMeaningLine={wordMeanings && !hide}
                onHover={p.onHover}
                onSingle={(x) => { p.onStep('tap'); p.onStep('meaning'); p.onTap(x); }}
                onDouble={(x) => { p.onStep('break'); p.onBreak(x); }}
              />
            ))}
          </div>
        </div>

        {p.translation && (
          <div className="zone zone-tr" dir={dirOf(lang)} lang={lang}>
            <span className="zone-tag" aria-hidden="true">{langLabel}</span>
            <p>{p.translation.text}</p>
          </div>
        )}

        {chipWord && (
          <div className="chip-slot">
            <WordChip word={chipWord} notice={p.notice} onListen={p.onListen} onBreak={(x) => { p.onStep('break'); p.onBreak(x); }} onClose={p.onClose} />
          </div>
        )}
      </div>
      {audioMsg && <p className="notice" role="status">{audioMsg}</p>}

      <RecitationPanel
        ayah={p.ayah}
        onHearWord={p.onListen}
        onBreakWord={p.onBreak}
        toolbar={(
          <>
            <button className="btn small ghost" aria-pressed={readMode} onClick={() => { setReadMode(!readMode); setRevealed(false); }}>👁 {t('readMode')}</button>
            {hide && <button className="btn small" onClick={() => setRevealed(true)}>{t('reveal')}</button>}
            <button className="btn small push" onClick={() => { p.onStep('read'); p.onComplete(); }} disabled={p.completed}>{p.completed ? '✓ ' + t('done') : t('iReadIt')}</button>
          </>
        )}
      />
    </article>
  );
}
