import { useState } from 'react';
import type { Word } from '@quran-shikkha/api-client';
import { pickByLang, pronScript, pronText } from '@quran-shikkha/learning-core';
import { api, authed } from '../lib/api';
import { playUrl, wordAudioUrl } from '../lib/audio';
import { pron } from '../lib/pron';
import { useAsync } from '../lib/useAsync';
import { useSettings } from '../settings';
import { Async, Empty } from '../components/States';

interface Card { wordKey: string; word: Word | null }

async function findWord(key: string): Promise<Word | null> {
  const [s, a] = key.split(':').map(Number);
  if (!s || !a) return null;
  const r = await api.GET('/api/v1/surahs/{n}/ayahs', { params: { path: { n: s } } });
  return r.data?.find((x) => x.ayah === a)?.words.find((w) => w.key === key) ?? null;
}

/** SM-2 spaced repetition. The server owns scheduling; this screen only grades. */
export default function Flashcards() {
  const { t, lang } = useSettings();
  const [shown, setShown] = useState(false);
  const [idx, setIdx] = useState(0);
  const [saveErr, setSaveErr] = useState(false);

  const [state, retry] = useAsync(async () => {
    const r = await authed(() => api.GET('/api/v1/flashcards/due'));
    const rows = (r.data ?? []) as { wordKey: string }[];
    const cards: Card[] = await Promise.all(rows.map(async (c) => ({ wordKey: c.wordKey, word: await findWord(c.wordKey) })));
    return cards.filter((c) => c.word);
  }, []);

  const grade = async (card: Card, quality: number) => {
    setSaveErr(false);
    try {
      const r = await authed(() => api.POST('/api/v1/flashcards/review', { body: { wordKey: card.wordKey, quality } }));
      if (!r.response.ok) throw new Error('review');
      setShown(false); setIdx((i) => i + 1);
    } catch { setSaveErr(true); }
  };

  return (
    <div>
      <h1>{t('dueCards')}</h1>
      <Async state={state} retry={retry}>
        {(cards) => {
          const c = cards[idx];
          if (!c || !c.word) return <Empty>{t('noDue')}</Empty>;
          const w = c.word;
          const p = pron(w.arabicText);
          const meaning = pickByLang(lang, w.meaningBn, w.meaningEn);
          const audio = wordAudioUrl(w.audioPath);
          return (
            <section className="flash" aria-label={`${idx + 1} / ${cards.length}`}>
              <p className="meta">{idx + 1} / {cards.length}</p>
              <div className="ar flash-ar" lang="ar" dir="rtl">{w.arabicText}</div>
              {audio && <button className="btn" onClick={() => void playUrl(audio)}>🔊 {t('listen')}</button>}
              {!shown ? (
                <button className="btn primary" onClick={() => setShown(true)}>{t('showAnswer')}</button>
              ) : (
                <>
                  <p className="chip-pron" lang={pronScript(lang) === 'bn' ? 'bn' : 'en'}>{pronText(p, lang)}</p>
                  <p className="chip-meaning" lang={lang}>{meaning ?? t('noMeaning')}</p>
                  <div className="row">
                    <button className="btn" onClick={() => void grade(c, 1)}>{t('again')}</button>
                    <button className="btn" onClick={() => void grade(c, 3)}>{t('hard')}</button>
                    <button className="btn" onClick={() => void grade(c, 4)}>{t('good')}</button>
                    <button className="btn" onClick={() => void grade(c, 5)}>{t('easy')}</button>
                  </div>
                </>
              )}
              {saveErr && <p className="notice" role="alert">{t('errorBody')}</p>}
            </section>
          );
        }}
      </Async>
    </div>
  );
}
