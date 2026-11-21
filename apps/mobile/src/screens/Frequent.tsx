import { Pressable, ScrollView, Text, View } from 'react-native';
import type { Word } from '@quran-shikkha/api-client';
import { pickByLang, pronText } from '@quran-shikkha/learning-core';
import { api } from '../api';
import { pron } from '../pron';
import { useAsync } from '../useAsync';
import { useSettings } from '../settings';
import { useWordInteraction } from '../useWordInteraction';
import { Async, Card, T } from '../components/Ui';

/** The ~300 most common words of the whole Quran with Bangla and English meanings. Coverage is computed from the data. */
export default function Frequent() {
  const { t, lang, showPron, colors: c } = useSettings();
  const wi = useWordInteraction(0);
  const [state, retry] = useAsync(async () => {
    const r = await api.GET('/api/v1/tracks/frequent', { params: { query: { size: 300 } } });
    if (!r.data) throw new Error('track');
    return r.data;
  }, []);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 90 }}>
      <T bold style={{ fontSize: 22 }}>{t('frequent')}</T>
      <Async state={state} retry={retry}>
        {(d) => (
          <View>
            <T accessibilityLiveRegion="polite">{d.words.length} {t('wordsCount')} · {t('coverage')} {d.coveragePercent}% {t('coverageOf')}</T>
            {d.words.map((w) => {
              const word: Word = { key: w.exampleKey, position: 0, arabicText: w.arabicText, audioPath: w.audioPath ?? null, meaningBn: w.meaningBn ?? null, meaningEn: w.meaningEn ?? null, translitLatin: null, charType: 'word' };
              const primary = pickByLang(lang, w.meaningBn, w.meaningEn);
              const other = lang === 'bn' ? w.meaningEn : w.meaningBn;
              return (
                <Pressable key={w.rank} onPress={() => wi.tap(word)} accessibilityRole="button" accessibilityLabel={`${w.rank}. ${w.arabicText}. ${primary ?? ''}`} style={{ minHeight: 44 }}>
                  <Card>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <T style={{ color: c.muted, width: 28, fontSize: 13 }}>{w.rank}</T>
                      <Text style={{ fontFamily: 'AmiriQuran_400Regular', fontSize: 30, color: c.text, width: 96, textAlign: 'center' }}>{w.arabicText}</Text>
                      <View style={{ flex: 1 }}>
                        <T bold>{primary ?? t('noMeaning')}</T>
                        {!!other && other !== primary && <T style={{ color: c.muted, fontSize: 14 }}>{other}</T>}
                        {showPron && <T style={{ color: c.muted, fontSize: 13 }}>{pronText(pron(w.arabicText), lang)}</T>}
                      </View>
                    </View>
                    <T style={{ color: c.muted, fontSize: 12 }}>{w.count.toLocaleString()} {t('count')} · {w.cumulativeCoveragePercent}%</T>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}
      </Async>
    </ScrollView>
  );
}
