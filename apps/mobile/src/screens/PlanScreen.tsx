import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import {
  AYAH_COUNTS, GOALS, PLAN_LENGTHS, ayahsPerDay, buildPlan, clampDays, lastDays, planDay, planEnded, planProgress, readIn, rebalance, streak, summarize, surahName, todayCount, wordsPerDay,
  type PlanOrder,
} from '@quran-shikkha/learning-core';
import { api } from '../api';
import { readingStore, useReading } from '../readingStore';
import { useAsync } from '../useAsync';
import { useSettings } from '../settings';
import { Btn, Card, T } from '../components/Ui';
import type { Nav } from '../nav';

const fill = (tpl: string, v: Record<string, string | number>) => Object.entries(v).reduce((s, [k, x]) => s.replace(`%${k}`, String(x)), tpl);

export default function PlanScreen({ open }: { open: (s: Nav) => void }) {
  const { t, lang, colors: c } = useSettings();
  const { reading, plan, done } = useReading();
  const [len, setLen] = useState(30);
  const [custom, setCustom] = useState('');
  const [order, setOrder] = useState<PlanOrder>('beginner');
  const [confirm, setConfirm] = useState(false);
  const [chapters] = useAsync(async () => (await api.GET('/api/v1/surahs')).data ?? [], []);
  const nameOf = (id: number) => { const ch = chapters.status === 'ready' ? chapters.data.find((x) => x.id === id) : undefined; return ch ? surahName(lang, ch) : `${t('surah')} ${id}`; };
  const sum = summarize(done);
  const days = clampDays(custom ? Number(custom) : len);
  const labels: Record<number, string> = { 30: t('days30'), 60: t('days60'), 90: t('days90') };

  const body = !plan ? (
    <View>
      <T style={{ color: c.muted }}>{t('planIntro')}</T>
      <T bold>{t('planLength')}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {PLAN_LENGTHS.map((n) => <Btn key={n} kind={!custom && len === n ? 'primary' : 'normal'} label={labels[n]!} onPress={() => { setCustom(''); setLen(n); }} />)}
      </View>
      <TextInput value={custom} onChangeText={(v) => setCustom(v.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" placeholder={t('customDays')} placeholderTextColor={c.muted} accessibilityLabel={t('customDays')}
        style={{ minHeight: 48, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 14, color: c.text, backgroundColor: c.surface, width: 160, marginVertical: 6 }} />
      <T bold>{t('planOrder')}</T>
      <Btn kind={order === 'beginner' ? 'primary' : 'normal'} label={t('orderBeginner')} onPress={() => setOrder('beginner')} />
      <Btn kind={order === 'mushaf' ? 'primary' : 'normal'} label={t('orderMushaf')} onPress={() => setOrder('mushaf')} />
      <T accessibilityLiveRegion="polite" style={{ marginVertical: 8 }}>{fill(t('planPreview'), { a: ayahsPerDay(days), w: wordsPerDay(days) })}</T>
      <Btn kind="primary" label={t('createPlan')} onPress={() => readingStore.setPlan(buildPlan({ order, days }))} />
    </View>
  ) : (() => {
    const p = planProgress(plan, done);
    const inPlan = p.day >= 1 && p.day <= plan.days;
    const today = inPlan ? planDay(plan, p.day) : null;
    const checks = plan.checks[String(p.day)] ?? {};
    const label = { 'on-track': t('statusOn'), ahead: t('statusAhead'), behind: t('statusBehind'), 'not-started': t('statusNot'), finished: t('statusDone') }[p.status];
    const rng = (s: { from: number; to: number }) => (s.from === s.to ? String(s.from) : `${s.from}–${s.to}`);
    const todayRead = today ? readIn(today.segments, done) : 0;
    return (
      <View>
        <Card>
          <T bold>{inPlan ? fill(t('planDayOf'), { d: p.day, n: plan.days }) : p.status === 'finished' ? t('statusDone') : p.day < 1 ? `${t('statusNot')} · ${plan.startDate}` : t('planEnded')} · {label}</T>
          <T style={{ color: c.muted, fontSize: 13 }}>{p.read.toLocaleString()} / {p.total.toLocaleString()} {t('ayahsCount')} · {plan.startDate} → {plan.endDate}</T>
          {p.status === 'finished' && <T bold>{t('planDoneMsg')}</T>}
          {(p.status === 'behind' || (planEnded(plan) && p.status !== 'finished')) && <><T style={{ color: c.muted, fontSize: 13 }}>{t('replanHint')}</T><Btn label={t('replan')} onPress={() => readingStore.setPlan(rebalance(plan, done))} /></>}
        </Card>
        {today && (
          <Card>
            <T bold style={{ fontSize: 18 }}>{t('todaysPlan')}</T>
            <T bold>{todayRead === today.ayahs ? '✓ ' : ''}{t('taskRead')} · {todayRead} / {today.ayahs}</T>
            {today.segments.map((s) => (
              <View key={`${s.surah}:${s.from}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Btn kind="ghost" label={`${nameOf(s.surah)} ${rng(s)}`} onPress={() => open({ name: 'reader', surah: s.surah, from: s.from })} />
                <T style={{ color: c.muted, fontSize: 13 }}>{readIn([s], done)} / {s.to - s.from + 1}</T>
              </View>
            ))}
            {today.words && (
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                <Btn kind={checks.words ? 'primary' : 'normal'} label={`${checks.words ? '✓' : '○'} ${t('taskWords')}`} onPress={() => readingStore.tick(p.day, 'words', !checks.words)} />
                <T style={{ color: c.muted, fontSize: 13 }}>{fill(t('wordsRange'), { a: today.words.from, b: today.words.to })}</T>
              </View>
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <Btn kind={checks.review ? 'primary' : 'normal'} label={`${checks.review ? '✓' : '○'} ${t('taskReview')}`} onPress={() => readingStore.tick(p.day, 'review', !checks.review)} />
              <Btn kind="ghost" label={t('taskExtra')} onPress={() => open({ name: 'learn' })} />
            </View>
          </Card>
        )}
        {!confirm ? <Btn kind="ghost" label={t('deletePlan')} onPress={() => setConfirm(true)} /> : (
          <Card><T>{t('confirmDelete')}</T><View style={{ flexDirection: 'row' }}><Btn label={t('deletePlan')} onPress={() => readingStore.setPlan(null)} /><Btn kind="ghost" label={t('close')} onPress={() => setConfirm(false)} /></View></Card>
        )}
      </View>
    );
  })();

  const bars = lastDays(reading.days, 14);
  const max = Math.max(1, reading.goal, ...bars.map((b) => b.count));
  const started = [...sum.perSurah].sort((a, b) => b.read / b.total - a.read / a.total || a.surah - b.surah).slice(0, 20);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 90 }}>
      <T bold style={{ fontSize: 22 }}>{t('myPlan')}</T>
      {body}
      <T bold style={{ fontSize: 20, marginTop: 16 }}>{t('myProgress')}</T>
      {sum.totalRead === 0 && <T style={{ color: c.muted }}>{t('noProgress')}</T>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {[[`🔥 ${streak(reading.days)}`, t('streak')], [`${todayCount(reading)} / ${reading.goal}`, t('todayRead')], [sum.totalRead.toLocaleString(), t('totalRead')], [`${sum.percent}%`, t('ofQuran')], [String(sum.surahsDone), t('surahsDone')]].map(([big, small]) => (
          <View key={small} style={{ width: '31%', margin: '1%', backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 8, alignItems: 'center' }}>
            <T bold style={{ color: c.accent, fontSize: 18 }}>{big}</T><T style={{ color: c.muted, fontSize: 11, textAlign: 'center' }}>{small}</T>
          </View>
        ))}
      </View>
      <T style={{ color: c.muted, fontSize: 13 }}>{t('goalPerDay')}</T>
      <View style={{ flexDirection: 'row' }}>{GOALS.map((g) => <Btn key={g} kind={reading.goal === g ? 'primary' : 'normal'} label={String(g)} onPress={() => readingStore.setGoal(g)} />)}</View>
      <T bold style={{ marginTop: 8 }}>{t('last14')}</T>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 70, gap: 3 }} accessibilityLabel={t('last14')}>
        {bars.map((b) => <View key={b.date} style={{ flex: 1, height: Math.max(3, (70 * b.count) / max), backgroundColor: b.count ? c.accent : c.surface2, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />)}
      </View>
      {started.length > 0 && <T bold style={{ marginTop: 8 }}>{t('bySurah')}</T>}
      {started.map((s) => (
        <View key={s.surah} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 36, gap: 8 }}>
          <T style={{ width: 110, fontSize: 13 }} numberOfLines={1}>{s.surah}. {nameOf(s.surah)}</T>
          <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: c.line }}><View style={{ width: `${(100 * s.read) / s.total}%`, height: 8, borderRadius: 4, backgroundColor: c.accent }} /></View>
          <T style={{ width: 56, fontSize: 12, color: c.muted, textAlign: 'right' }}>{s.read}/{AYAH_COUNTS[s.surah - 1]}</T>
        </View>
      ))}
    </ScrollView>
  );
}
