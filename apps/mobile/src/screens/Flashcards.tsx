import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { Word } from '@quran-shikkha/api-client';
import { pickByLang, pronText } from '@quran-shikkha/learning-core';
import { api, authed } from '../api';
import { play } from '../audio';
import { pron } from '../pron';
import { useAsync } from '../useAsync';
import { useSettings } from '../settings';
import { Async, Btn, Disclaimer, T } from '../components/Ui';

interface Card { wordKey: string; word: Word }

async function findWord(key: string): Promise<Word | null> {
  const [s, a] = key.split(':').map(Number);
  if (!s || !a) return null;
  const r = await api.GET('/api/v1/surahs/{n}/ayahs', { params: { path: { n: s } } });
  return r.data?.find((x) => x.ayah === a)?.words.find((w) => w.key === key) ?? null;
}

export default function Flashcards() {
  const { t, lang, colors: c } = useSettings();
  const [shown, setShown] = useState(false);
  const [idx, setIdx] = useState(0);
  const [err, setErr] = useState(false);
  const [state, retry] = useAsync(async () => {
    const rows = (((await authed(() => api.GET('/api/v1/flashcards/due'))).data ?? []) as { wordKey: string }[]);
    const out: Card[] = [];
    for (const r of rows) { const w = await findWord(r.wordKey); if (w) out.push({ wordKey: r.wordKey, word: w }); }
    return out;
  }, []);

  const grade = (card: Card, q: number) => {
    setErr(false);
    void authed(() => api.POST('/api/v1/flashcards/review', { body: { wordKey: card.wordKey, quality: q } }))
      .then((r) => { if (!r.response.ok) throw new Error('x'); setShown(false); setIdx((i) => i + 1); }, () => setErr(true));
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
      <T bold style={{ fontSize: 22 }}>{t('dueCards')}</T>
      <Disclaimer />
      <Async state={state} retry={retry}>
        {(cards) => {
          const cur = cards[idx];
          if (!cur) return <T style={{ color: c.muted, textAlign: 'center' }}>{t('noDue')}</T>;
          const w = cur.word; const p = pron(w.arabicText);
          const meaning = pickByLang(lang, w.meaningBn, w.meaningEn);
          const surah = Number(cur.wordKey.split(':')[0]);
          return (
            <View style={{ alignItems: 'center', gap: 8 }}>
              <T style={{ color: c.muted }}>{idx + 1} / {cards.length}</T>
              <T style={{ fontFamily: 'AmiriQuran_400Regular', fontSize: 56, lineHeight: 110 }}>{w.arabicText}</T>
              {w.audioPath && <Btn label={`🔊 ${t('listen')}`} onPress={() => void play(surah, w.audioPath)} />}
              {!shown ? <Btn kind="primary" label={t('showAnswer')} onPress={() => setShown(true)} /> : (
                <>
                  <T bold>{pronText(p, lang)}</T>
                  <T>{meaning ?? t('noMeaning')}</T>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    <Btn label={t('again')} onPress={() => grade(cur, 1)} /><Btn label={t('hard')} onPress={() => grade(cur, 3)} />
                    <Btn label={t('good')} onPress={() => grade(cur, 4)} /><Btn label={t('easy')} onPress={() => grade(cur, 5)} />
                  </View>
                </>
              )}
              {err && <T style={{ fontSize: 14 }}>{t('errorBody')}</T>}
            </View>
          );
        }}
      </Async>
    </ScrollView>
  );
}
