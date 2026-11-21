import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import {
  AYAH_COUNTS, juzSegments, planDay, planProgress, streak, suggestNext, summarize, surahName, todayCount,
} from '@quran-shikkha/learning-core';
import { api } from '../api';
import { readingStore, useReading } from '../readingStore';
import { useAsync } from '../useAsync';
import { useSettings } from '../settings';
import { Async, Btn, Card, T } from '../components/Ui';
import { Hero, Ring, StarBadge } from '../components/Premium';
import type { Nav } from '../nav';

const fold = (s: string) => s.toLowerCase().replace(/[\s\-'’‘ʿʾ]/g, '');

export default function Home({ open }: { open: (s: Nav) => void }) {
  const { t, lang, colors: c } = useSettings();
  const { reading, plan, done } = useReading();
  const [tab, setTab] = useState<'surahs' | 'juz'>('surahs');
  const [q, setQ] = useState('');
  const [state, retry] = useAsync(async () => {
    const [chapters, lessons] = await Promise.all([api.GET('/api/v1/surahs'), api.GET('/api/v1/lessons')]);
    if (!chapters.data) throw new Error('home');
    const familiarId = ((lessons.data ?? []) as { id: number; type: string }[]).find((l) => l.type === 'familiar')?.id;
    return { chapters: chapters.data, familiarId };
  }, []);
  const sum = summarize(done);
  const last = reading.last;
  const next = suggestNext(done);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 90 }} keyboardShouldPersistTaps="handled">
      <Async state={state} retry={retry}>
        {({ chapters, familiarId }) => {
          const nameOf = (id: number) => { const ch = chapters.find((x) => x.id === id); return ch ? surahName(lang, ch) : String(id); };
          const lastDone = last ? (done[last.surah] ?? []).length : 0;
          const pp = plan ? planProgress(plan, done) : null;
          const day = plan && pp && pp.day >= 1 && pp.day <= plan.days ? planDay(plan, pp.day) : null;
          const label = pp ? { 'on-track': t('statusOn'), ahead: t('statusAhead'), behind: t('statusBehind'), 'not-started': t('statusNot'), finished: t('statusDone') }[pp.status] : '';
          const f = fold(q);
          const shown = chapters.filter((ch) => !f || String(ch.id) === f || fold(surahName(lang, ch)).includes(f) || fold(ch.nameSimple).includes(f) || ch.nameArabic.includes(q.trim()));

          return (
            <View>
              <Hero>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ flex: 1 }}>
                    <T bold style={{ color: c.onAccent, fontSize: 12, opacity: 0.85 }}>{(last ? t('continueReading') : t('startHere')).toUpperCase()}</T>
                    <T bold style={{ color: c.onAccent, fontSize: 24, lineHeight: 32 }}>{last ? `${nameOf(last.surah)} · ${t('ayah')} ${last.ayah}` : t('startFatiha')}</T>
                    {!last && <T style={{ color: c.onAccent, opacity: 0.9, fontSize: 13 }}>{t('how1')}</T>}
                  </View>
                  {last && <Ring value={lastDone / (AYAH_COUNTS[last.surah - 1] ?? 1)} size={76} stroke={7} color={c.onAccent}><T bold style={{ color: c.onAccent, fontSize: 14 }}>{Math.round((100 * lastDone) / (AYAH_COUNTS[last.surah - 1] ?? 1))}%</T></Ring>}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
                  <Pressable accessibilityRole="button" onPress={() => open({ name: 'reader', surah: last?.surah ?? 1, from: last?.ayah })}
                    style={{ minHeight: 44, borderRadius: 22, paddingHorizontal: 20, backgroundColor: c.surface, justifyContent: 'center', marginRight: 8 }}>
                    <T bold style={{ color: c.accent }}>{last ? t('continueReading') : t('startReading')} →</T>
                  </Pressable>
                  {last && next && next !== last.surah && (
                    <Pressable accessibilityRole="button" onPress={() => open({ name: 'reader', surah: next })} style={{ minHeight: 44, borderRadius: 22, paddingHorizontal: 16, borderWidth: 1, borderColor: c.onAccent, justifyContent: 'center' }}>
                      <T style={{ color: c.onAccent }}>{t('nextUp')}: {nameOf(next)}</T>
                    </Pressable>
                  )}
                </View>
              </Hero>

              {(last || sum.totalRead > 0) && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  {([[`🔥 ${streak(reading.days)}`, t('streak'), Math.min(1, streak(reading.days) / 7)], [`${todayCount(reading)}`, `${t('todayRead')} / ${reading.goal}`, todayCount(reading) / Math.max(1, reading.goal)], [`${sum.percent}%`, t('ofQuran'), sum.percent / 100]] as [string, string, number][]).map(([big, small, val]) => (
                    <View key={small} style={{ flex: 1, margin: 3, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 20, paddingVertical: 12, alignItems: 'center', gap: 6 }}>
                      <Ring value={val} size={64} stroke={6}><T bold style={{ color: c.accent, fontSize: 14 }}>{big}</T></Ring>
                      <T style={{ color: c.muted, fontSize: 11, textAlign: 'center' }}>{small}</T>
                    </View>
                  ))}
                </View>
              )}

              <Pressable accessibilityRole="button" onPress={() => open({ name: 'plan' })}>
                <Card>
                  <T bold style={{ color: c.accent }}>📅 {plan && pp ? `${t('todaysPlan')} · ${day ? t('planDayOf').replace('%d', String(pp.day)).replace('%n', String(plan.days)) : label}` : t('myPlan')}</T>
                  <T style={{ color: c.muted, fontSize: 14 }}>{plan && pp ? `${label} · ${pp.read.toLocaleString()} / ${pp.total.toLocaleString()} ${t('ayahsCount')}` : t('makePlanCard')}</T>
                </Card>
              </Pressable>

              <T bold style={{ fontSize: 18, marginTop: 8 }}>📌 {t('savedPlaces')}</T>
              {reading.bookmarks.length === 0 ? <T style={{ color: c.muted, fontSize: 14 }}>{t('noSaved')}</T> : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {reading.bookmarks.slice(0, 8).map((b) => (
                    <View key={`${b.surah}:${b.ayah}`} style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c.line, borderRadius: 20, backgroundColor: c.surface, margin: 3, paddingLeft: 12 }}>
                      <Pressable accessibilityRole="button" onPress={() => open({ name: 'reader', surah: b.surah, from: b.ayah })} style={{ minHeight: 40, justifyContent: 'center' }}><T style={{ fontSize: 14 }}>{nameOf(b.surah)} · {b.ayah}</T></Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel={t('unpin')} onPress={() => readingStore.togglePin(b.surah, b.ayah)} style={{ minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' }}><T style={{ color: c.muted }}>✕</T></Pressable>
                    </View>
                  ))}
                </View>
              )}

              <T bold style={{ fontSize: 18, marginTop: 8 }}>{t('learnMore')}</T>
              {([['🍎', t('dailyArabic'), t('dailyIntro'), { name: 'learn' }], ['📺', t('watchRead'), t('watchIntro'), { name: 'watch' }], ['🔤', t('frequent'), t('frequentDesc'), { name: 'frequent' }]] as [string, string, string, Nav][]).map(([icon, title, desc, nav]) => (
                <Pressable key={title} accessibilityRole="button" onPress={() => open(nav)}><Card><T bold style={{ color: c.accent }}>{icon} {title}</T><T style={{ color: c.muted, fontSize: 14 }}>{desc}</T></Card></Pressable>
              ))}
              {familiarId && <Pressable accessibilityRole="button" onPress={() => open({ name: 'familiar', id: familiarId })}><Card><T bold style={{ color: c.accent }}>🕌 {t('lessonFamiliar')}</T><T style={{ color: c.muted, fontSize: 14 }}>{t('familiarIntro')}</T></Card></Pressable>}

              <T bold style={{ fontSize: 18, marginTop: 8 }}>{t('browse')}</T>
              <View style={{ flexDirection: 'row' }}>
                <Btn kind={tab === 'surahs' ? 'primary' : 'normal'} label={`${t('tabSurahs')} (114)`} onPress={() => setTab('surahs')} />
                <Btn kind={tab === 'juz' ? 'primary' : 'normal'} label={`${t('tabJuz')} (30)`} onPress={() => setTab('juz')} />
              </View>
              {tab === 'juz' ? Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
                <Card key={j}>
                  <T bold style={{ color: c.accent }}>{t('juz')} {j}</T>
                  {juzSegments(j).map((s) => (
                    <Pressable key={s.surah} accessibilityRole="button" onPress={() => open({ name: 'reader', surah: s.surah, from: s.from })} style={{ minHeight: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <T>{s.surah}. {nameOf(s.surah)}</T><T style={{ color: c.muted, fontSize: 13 }}>{s.from}–{s.to}</T>
                    </Pressable>
                  ))}
                </Card>
              )) : (
                <View>
                  <TextInput value={q} onChangeText={setQ} placeholder={t('searchSurah')} placeholderTextColor={c.muted} accessibilityLabel={t('searchSurah')}
                    style={{ minHeight: 48, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 14, color: c.text, backgroundColor: c.surface, marginVertical: 8, fontFamily: 'NotoSansBengali_400Regular' }} />
                  {shown.map((ch) => (
                    <Pressable key={ch.id} accessibilityRole="button" accessibilityLabel={surahName(lang, ch)} onPress={() => open({ name: 'reader', surah: ch.id })}>
                      <Card>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <StarBadge n={ch.id} />
                          <View style={{ flex: 1 }}><T bold>{surahName(lang, ch)}</T><T style={{ color: c.muted, fontSize: 13 }}>{ch.versesCount || AYAH_COUNTS[ch.id - 1]} {t('ayahsCount')}{(done[ch.id] ?? []).length ? ` · ✓ ${(done[ch.id] ?? []).length}` : ''}</T></View>
                        </View>
                      </Card>
                    </Pressable>
                  ))}
                </View>
              )}
              <Btn kind="ghost" label={t('credits')} onPress={() => open({ name: 'credits' })} />
            </View>
          );
        }}
      </Async>
    </ScrollView>
  );
}
