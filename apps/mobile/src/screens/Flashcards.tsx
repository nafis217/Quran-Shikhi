import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { Word } from '@quran-shikkha/api-client';
import { meaningOf, pickByLang, pronText, vocabById, type VocabWord } from '@quran-shikkha/learning-core';
import { api, authed } from '../api';
import { play } from '../audio';
import { pron } from '../pron';
import { speakArabic } from '../speech';
import { vocabPron } from '../vocabPron';
import { useAsync } from '../useAsync';
import { useSettings } from '../settings';
import { Async, Btn, T } from '../components/Ui';

/** A Quran word (key "2:255:1") or a daily word (key "v:animals.cat"). */
interface Card { wordKey: string; word: Word | null; vocab: VocabWord | null }

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
    for (const r of rows) {
      if (r.wordKey.startsWith('v:')) { const v = vocabById(r.wordKey.slice(2)); if (v) out.push({ wordKey: r.wordKey, word: null, vocab: v }); continue; }
      const w = await findWord(r.wordKey); if (w) out.push({ wordKey: r.wordKey, word: w, vocab: null });
    }
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
      <Async state={state} retry={retry}>
        {(cards) => {
          const cur = cards[idx];
          if (!cur) return <T style={{ color: c.muted, textAlign: 'center' }}>{t('noDue')}</T>;
          const v = cur.vocab, w = cur.word;
          const arabic = v ? v.ar : w!.arabicText;
          const guide = v ? vocabPron(v, lang) : pronText(pron(w!.arabicText), lang);
          const meaning = v ? meaningOf(v, lang) : pickByLang(lang, w!.meaningBn, w!.meaningEn);
          const surah = Number(cur.wordKey.split(':')[0]);
          return (
            <View style={{ alignItems: 'center', gap: 8 }}>
              <T style={{ color: c.muted }}>{idx + 1} / {cards.length}</T>
              {v && v.visual && <Text style={{ fontSize: 72 }} accessibilityLabel={v.en}>{v.emoji}</Text>}
              <T style={{ fontFamily: 'AmiriQuran_400Regular', fontSize: 56, lineHeight: 110 }}>{arabic}</T>
              {w?.audioPath && <Btn label={`🔊 ${t('listen')}`} onPress={() => void play(surah, w.audioPath)} />}
              {v && <Btn label={`🔊 ${t('speak')}`} onPress={() => void speakArabic(v.ar)} />}
              {!shown ? <Btn kind="primary" label={t('showAnswer')} onPress={() => setShown(true)} /> : (
                <>
                  <T bold>{guide}</T>
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
