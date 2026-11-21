import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { AYAH_COUNTS, juzSegments, surahName } from '@quran-shikkha/learning-core';
import { api } from '../api';
import { useAsync } from '../useAsync';
import { useSettings } from '../settings';
import { Async, Btn, Card, T } from '../components/Ui';
import type { Nav } from '../nav';

const fold = (s: string) => s.toLowerCase().replace(/[\s\-'’‘ʿʾ]/g, '');

export default function Home({ open }: { open: (s: Nav) => void }) {
  const { t, lang, colors: c } = useSettings();
  const [tab, setTab] = useState<'surahs' | 'juz'>('surahs');
  const [q, setQ] = useState('');
  const [state, retry] = useAsync(async () => {
    const [chapters, lessons] = await Promise.all([api.GET('/api/v1/surahs'), api.GET('/api/v1/lessons')]);
    if (!chapters.data) throw new Error('home');
    const familiarId = ((lessons.data ?? []) as { id: number; type: string }[]).find((l) => l.type === 'familiar')?.id;
    return { chapters: chapters.data, familiarId };
  }, []);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 90 }} keyboardShouldPersistTaps="handled">
      <T bold style={{ fontSize: 24 }}>{t('appName')}</T>
      <T style={{ color: c.muted }}>{t('loop')}</T>

      <T bold style={{ fontSize: 18, marginTop: 12 }}>{t('startHere')}</T>
      <Pressable accessibilityRole="button" onPress={() => open({ name: 'reader', surah: 1 })}><Card><T bold style={{ color: c.accent }}>{t('pathTitle')}</T><T style={{ color: c.muted, fontSize: 14 }}>{t('pathDesc')}</T></Card></Pressable>
      <Async state={state} retry={retry}>
        {(d) => d.familiarId ? <Pressable accessibilityRole="button" onPress={() => open({ name: 'familiar', id: d.familiarId! })}><Card><T bold style={{ color: c.accent }}>{t('lessonFamiliar')}</T><T style={{ color: c.muted, fontSize: 14 }}>{t('familiarIntro')}</T></Card></Pressable> : <></>}
      </Async>
      <Pressable accessibilityRole="button" onPress={() => open({ name: 'frequent' })}><Card><T bold style={{ color: c.accent }}>{t('frequent')}</T><T style={{ color: c.muted, fontSize: 14 }}>{t('frequentDesc')}</T></Card></Pressable>

      <T bold style={{ fontSize: 18, marginTop: 12 }}>{t('browse')}</T>
      <View style={{ flexDirection: 'row' }}>
        <Btn kind={tab === 'surahs' ? 'primary' : 'normal'} label={`${t('tabSurahs')} (114)`} onPress={() => setTab('surahs')} />
        <Btn kind={tab === 'juz' ? 'primary' : 'normal'} label={`${t('tabJuz')} (30)`} onPress={() => setTab('juz')} />
      </View>

      <Async state={state} retry={retry}>
        {({ chapters }) => {
          const nameOf = (id: number) => { const ch = chapters.find((x) => x.id === id); return ch ? surahName(lang, ch) : String(id); };
          if (tab === 'juz')
            return (
              <View>
                {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
                  <Card key={j}>
                    <T bold style={{ color: c.accent }}>{t('juz')} {j}</T>
                    {juzSegments(j).map((s) => (
                      <Pressable key={s.surah} accessibilityRole="button" onPress={() => open({ name: 'reader', surah: s.surah, from: s.from })} style={{ minHeight: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <T>{s.surah}. {nameOf(s.surah)}</T><T style={{ color: c.muted, fontSize: 13 }}>{s.from}–{s.to}</T>
                      </Pressable>
                    ))}
                  </Card>
                ))}
              </View>
            );
          const f = fold(q);
          const shown = chapters.filter((ch) => !f || String(ch.id) === f || fold(surahName(lang, ch)).includes(f) || fold(ch.nameSimple).includes(f) || ch.nameArabic.includes(q.trim()));
          return (
            <View>
              <TextInput value={q} onChangeText={setQ} placeholder={t('searchSurah')} placeholderTextColor={c.muted} accessibilityLabel={t('searchSurah')}
                style={{ minHeight: 48, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 14, color: c.text, backgroundColor: c.surface, marginVertical: 8, fontFamily: 'NotoSansBengali_400Regular' }} />
              {shown.map((ch) => {
                return (
                  <Pressable key={ch.id} accessibilityRole="button" accessibilityLabel={surahName(lang, ch)} onPress={() => open({ name: 'reader', surah: ch.id })}>
                    <Card>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}><T bold style={{ color: c.accent, fontSize: 14 }}>{ch.id}</T></View>
                        <View style={{ flex: 1 }}><T bold>{surahName(lang, ch)}</T><T style={{ color: c.muted, fontSize: 13 }}>{ch.versesCount || AYAH_COUNTS[ch.id - 1]} {t('ayahsCount')}</T></View>
                        {lang !== 'ar' && <T style={{ fontFamily: 'AmiriQuran_400Regular', fontSize: 22 }}>{ch.nameArabic}</T>}
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          );
        }}
      </Async>
    </ScrollView>
  );
}
