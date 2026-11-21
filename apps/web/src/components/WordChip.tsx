import { useState } from 'react';
import type { Word } from '@quran-shikkha/api-client';
import { api, authed } from '../lib/api';
import { pron } from '../lib/pron';
import { friendlyLatin, pickByLang, pronScript, pronText } from '@quran-shikkha/learning-core';
import { useSettings } from '../settings';

interface Props {
  word: Word;
  notice: string;
  onListen: (w: Word) => void;
  onBreak: (w: Word) => void;
  onClose: () => void;
}

/** "Bujhi": meaning chip with Bangla (English toggle), pronunciation and learning actions. */
export function WordChip({ word, notice, onListen, onBreak, onClose }: Props) {
  const { t, lang } = useSettings();
  const [added, setAdded] = useState(false);
  const [err, setErr] = useState(false);
  const p = pron(word.arabicText);
  const meaning = pickByLang(lang, word.meaningBn, word.meaningEn);

  const add = async () => {
    setErr(false);
    try {
      const r = await authed(() => api.POST('/api/v1/flashcards', { body: { wordKey: word.key } }));
      if (r.response.ok) setAdded(true); else setErr(true);
    } catch { setErr(true); }
  };

  return (
    <section className="chip" aria-label={word.arabicText}>
      <div className="chip-main">
        <span className="ar chip-ar" lang="ar" dir="rtl">{word.arabicText}</span>
        <div>
          <div className="chip-pron" lang={pronScript(lang) === 'bn' ? 'bn' : 'en'}>{pronText(p, lang)}</div>
          {pronScript(lang) === 'bn' && <div className="chip-latin">{friendlyLatin(p.latin)}</div>}
        </div>
      </div>
      <p className="chip-meaning" lang={lang} aria-live="polite">{meaning ?? t('noMeaning')}</p>
      {notice && <p className="notice" role="status">{notice}</p>}
      <div className="row">
        <button className="btn" onClick={() => onListen(word)}>🔊 {t('listen')}</button>
        <button className="btn" onClick={() => onBreak(word)}>✂ {t('breakdown')}</button>
        <button className="btn" onClick={() => void add()} disabled={added}>{added ? '✓ ' + t('cardAdded') : '＋ ' + t('addCard')}</button>
        <button className="btn ghost" onClick={onClose}>{t('close')}</button>
      </div>
      {err && <p className="notice" role="alert">{t('errorBody')}</p>}
    </section>
  );
}
