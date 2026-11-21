import { useState } from 'react';
import type { Word } from '@quran-shikkha/api-client';
import { meaningOf, pickByLang, pronScript, pronText, vocabById, type VocabWord } from '@quran-shikkha/learning-core';
import { api, authed } from '../lib/api';
import { playUrl, wordAudioUrl } from '../lib/audio';
import { pron } from '../lib/pron';
import { speakArabic } from '../lib/speech';
import { vocabPron } from '../lib/vocabPron';
import { useAsync } from '../lib/useAsync';
import { useSettings } from '../settings';
import { Async, Empty } from '../components/States';
import { PageHero } from '../components/PageHero';

/** A card is either a Quran word (key "2:255:1") or a daily word (key "v:animals.cat"). */
interface Card { wordKey: string; word: Word | null; vocab: VocabWord | null }

async function findWord(key: string): Promise<Word | null> {
  if (key.startsWith('v:')) return null;
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
    const cards: Card[] = await Promise.all(rows.map(async (c) => ({ wordKey: c.wordKey, word: await findWord(c.wordKey), vocab: c.wordKey.startsWith('v:') ? vocabById(c.wordKey.slice(2)) ?? null : null })));
    return cards.filter((c) => c.word || c.vocab);
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
      <PageHero compact overline={t('flashcards')} title={t('dueCards')} aside={<div className="hero-emoji" aria-hidden="true">🗂️</div>} />
      <Async state={state} retry={retry}>
        {(cards) => {
          const c = cards[idx];
          if (!c) return <Empty>{t('noDue')}</Empty>;
          const v = c.vocab, w = c.word;
          const arabic = v ? v.ar : w!.arabicText;
          const guide = v ? vocabPron(v, lang) : pronText(pron(w!.arabicText), lang);
          const meaning = v ? meaningOf(v, lang) : pickByLang(lang, w!.meaningBn, w!.meaningEn);
          const audio = w ? wordAudioUrl(w.audioPath) : null;
          const grades: [number, string][] = [[1, t('again')], [3, t('hard')], [4, t('good')], [5, t('easy')]];
          return (
            <section className="flash" aria-label={`${idx + 1} / ${cards.length}`}>
              <p className="meta">{idx + 1} / {cards.length}</p>
              {v && v.visual && <div className="pic-q" role="img" aria-label={v.en}>{v.emoji}</div>}
              <div className="ar flash-ar" lang="ar" dir="rtl">{arabic}</div>
              {audio && <button className="btn" onClick={() => void playUrl(audio)}>🔊 {t('listen')}</button>}
              {v && <button className="btn" onClick={() => speakArabic(v.ar)}>🔊 {t('speak')}</button>}
              {!shown ? (
                <button className="btn primary" onClick={() => setShown(true)}>{t('showAnswer')}</button>
              ) : (
                <>
                  <p className="chip-pron" lang={pronScript(lang) === 'bn' ? 'bn' : 'en'}>{guide}</p>
                  <p className="chip-meaning" lang={lang}>{meaning ?? t('noMeaning')}</p>
                  <div className="row">{grades.map(([q, label]) => <button key={q} className="btn" onClick={() => void grade(c, q)}>{label}</button>)}</div>
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
