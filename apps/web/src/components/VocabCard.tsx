import { useState } from 'react';
import { meaningOf, type VocabWord } from '@quran-shikkha/learning-core';
import { api, authed } from '../lib/api';
import { speakArabic } from '../lib/speech';
import { vocabPron } from '../lib/vocabPron';
import { useSettings } from '../settings';

/** A picture, the Arabic word with its vowels, a pronunciation guide, the meaning, a voice button and a flashcard button. */
export function VocabCard({ word, big }: { word: VocabWord; big?: boolean }) {
  const { t, lang, showPron } = useSettings();
  const [msg, setMsg] = useState('');
  const [added, setAdded] = useState(false);

  const speak = () => { const r = speakArabic(word.ar); setMsg(r === 'ok' ? '' : r === 'no-voice' ? t('noVoice') : t('noAudio')); };
  const add = async () => {
    try { const r = await authed(() => api.POST('/api/v1/flashcards', { body: { wordKey: `v:${word.id}` } })); if (r.response.ok) setAdded(true); } catch { setMsg(t('errorBody')); }
  };

  return (
    <article className="vcard" data-big={big || undefined}>
      <div className="vcard-pic" aria-hidden="true">{word.emoji}</div>
      <div className="vcard-ar ar" lang="ar" dir="rtl">{word.ar}</div>
      {showPron && <div className="vcard-pron" lang={lang === 'bn' ? 'bn' : 'en'}>{vocabPron(word, lang)}</div>}
      <div className="vcard-mean" lang={lang === 'bn' ? 'bn' : 'en'}>{meaningOf(word, lang)}</div>
      <div className="row vcard-actions">
        <button className="btn small" onClick={speak} aria-label={`${t('speak')}: ${word.en}`}>🔊 {t('speak')}</button>
        <button className="btn small ghost" onClick={() => void add()} disabled={added}>{added ? '✓ ' + t('cardAdded') : '＋ ' + t('addCard')}</button>
      </div>
      {msg && <p className="notice" role="status">{msg}</p>}
    </article>
  );
}
