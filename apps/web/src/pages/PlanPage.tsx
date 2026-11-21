import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AYAH_COUNTS, GOALS, PLAN_LENGTHS, ayahsPerDay, buildPlan, clampDays, dayComplete, juzSegments, lastDays, planDay, planEnded, planProgress, readIn, rebalance, streak,
  summarize, surahName, todayCount, wordsPerDay, type Plan, type PlanOrder, type PlanStatus,
} from '@quran-shikkha/learning-core';
import { api } from '../lib/api';
import { readingStore, useReading } from '../lib/readingStore';
import { useAsync } from '../lib/useAsync';
import { useSettings } from '../settings';
import { PageHero } from '../components/PageHero';
import { Ring } from '../components/Ring';

const fill = (tpl: string, vars: Record<string, string | number>) => Object.entries(vars).reduce((s, [k, v]) => s.replace(`%${k}`, String(v)), tpl);

function Wizard() {
  const { t } = useSettings();
  const [len, setLen] = useState<number>(30);
  const [custom, setCustom] = useState('45');
  const [useCustom, setUseCustom] = useState(false);
  const [order, setOrder] = useState<PlanOrder>('beginner');
  const days = clampDays(useCustom ? Number(custom) : len);
  const labels: Record<number, string> = { 30: t('days30'), 60: t('days60'), 90: t('days90') };

  return (
    <div className="wizard">
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 'var(--s2)' }}>
        <legend className="label" style={{ fontWeight: 700 }}>{t('planLength')}</legend>
        {PLAN_LENGTHS.map((n) => (
          <label key={n} className="radio"><input type="radio" name="len" checked={!useCustom && len === n} onChange={() => { setUseCustom(false); setLen(n); }} /><span>{labels[n]}</span></label>
        ))}
        <label className="radio"><input type="radio" name="len" checked={useCustom} onChange={() => setUseCustom(true)} />
          <span>{t('customDays')} <input className="num-input" type="number" min={14} max={365} value={custom} onChange={(e) => { setCustom(e.target.value); setUseCustom(true); }} aria-label={t('customDays')} /></span></label>
      </fieldset>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 'var(--s2)' }}>
        <legend className="label" style={{ fontWeight: 700 }}>{t('planOrder')}</legend>
        <label className="radio"><input type="radio" name="ord" checked={order === 'beginner'} onChange={() => setOrder('beginner')} /><span>{t('orderBeginner')}</span></label>
        <label className="radio"><input type="radio" name="ord" checked={order === 'mushaf'} onChange={() => setOrder('mushaf')} /><span>{t('orderMushaf')}</span></label>
      </fieldset>
      <p className="notice good" role="status">{fill(t('planPreview'), { a: ayahsPerDay(days), w: wordsPerDay(days) })}</p>
      <button className="btn primary" onClick={() => readingStore.setPlan(buildPlan({ order, days }))}>{t('createPlan')}</button>
    </div>
  );
}

function StatusChip({ s }: { s: PlanStatus }) {
  const { t } = useSettings();
  const label = { 'on-track': t('statusOn'), ahead: t('statusAhead'), behind: t('statusBehind'), 'not-started': t('statusNot'), finished: t('statusDone') }[s];
  return <span className="status" data-s={s}>{label}</span>;
}

function PlanView({ plan }: { plan: Plan }) {
  const { t, lang } = useSettings();
  const { done } = useReading();
  const [confirm, setConfirm] = useState(false);
  const [chapters] = useAsync(async () => (await api.GET('/api/v1/surahs')).data ?? [], []);
  const nameOf = (id: number) => { const c = chapters.status === 'ready' ? chapters.data.find((x) => x.id === id) : undefined; return c ? surahName(lang, c) : `${t('surah')} ${id}`; };

  const p = planProgress(plan, done);
  const inPlan = p.day >= 1 && p.day <= plan.days;
  const today = inPlan ? planDay(plan, p.day) : null;
  const checks = plan.checks[String(p.day)] ?? {};
  const range = (s: { from: number; to: number }) => (s.from === s.to ? String(s.from) : `${s.from}–${s.to}`);
  const todayRead = today ? readIn(today.segments, done) : 0;
  const readDone = today ? today.ayahs > 0 && todayRead === today.ayahs : false;
  const upcoming = Array.from({ length: 7 }, (_, i) => p.day + 1 + i).filter((d) => d >= 1 && d <= plan.days);
  const ended = planEnded(plan);

  return (
    <>
      <div className="card" style={{ marginBottom: 'var(--s3)' }}>
        <div className="reader-meta">
          <strong>{inPlan ? fill(t('planDayOf'), { d: p.day, n: plan.days }) : p.status === 'finished' ? t('statusDone') : p.day < 1 ? `${t('statusNot')} · ${plan.startDate}` : t('planEnded')}</strong>
          <StatusChip s={p.status} />
        </div>
        <div className="reader-meta"><span className="progress-bar" aria-hidden="true"><i style={{ width: `${(100 * p.read) / p.total}%` }} /></span><span className="meta">{p.read.toLocaleString()} / {p.total.toLocaleString()} {t('ayahsCount')}</span></div>
        <p className="meta">{plan.startDate} → {plan.endDate} · {fill(t('planPreview'), { a: ayahsPerDay(plan.days, plan.startIndex), w: wordsPerDay(plan.days) })}</p>
        {p.status === 'finished' && <p className="notice good" role="status">{t('planDoneMsg')}</p>}
        {(p.status === 'behind' || (ended && p.status !== 'finished')) && (
          <>
            <p className="meta">{t('replanHint')}</p>
            <button className="btn" onClick={() => readingStore.setPlan(rebalance(plan, done))}>{t('replan')}</button>
          </>
        )}
      </div>

      {today && (
        <section className="card" aria-label={t('todaysPlan')}>
          <h2 style={{ marginTop: 0 }}>{t('todaysPlan')}</h2>
          <div className="task" data-done={readDone || undefined}>
            <span className="box" aria-hidden="true">{readDone ? '✓' : ''}</span>
            <div>
              <h3>{t('taskRead')} · {todayRead} / {today.ayahs} {t('ayahsCount')}</h3>
              {today.segments.map((s) => (
                <div key={`${s.surah}:${s.from}`} className="seg-line">
                  <Link to={`/surah/${s.surah}?from=${s.from}`}>{nameOf(s.surah)} {range(s)}</Link>
                  <span className="meta">{readIn([s], done)} / {s.to - s.from + 1}</span>
                </div>
              ))}
            </div>
          </div>
          {today.words && (
            <div className="task" data-done={checks.words || undefined}>
              <button className="box" aria-pressed={!!checks.words} aria-label={t('markDone')} onClick={() => readingStore.tick(p.day, 'words', !checks.words)}>{checks.words ? '✓' : ''}</button>
              <div><h3>{t('taskWords')}</h3><Link to={`/frequent?from=${today.words.from}&to=${today.words.to}`}>{fill(t('wordsRange'), { a: today.words.from, b: today.words.to })} →</Link></div>
            </div>
          )}
          <div className="task" data-done={checks.review || undefined}>
            <button className="box" aria-pressed={!!checks.review} aria-label={t('markDone')} onClick={() => readingStore.tick(p.day, 'review', !checks.review)}>{checks.review ? '✓' : ''}</button>
            <div><h3>{t('taskReview')}</h3><Link to="/flashcards">{t('openIt')} →</Link></div>
          </div>
          <div className="task"><span className="box" aria-hidden="true">·</span><div><h3>{t('taskExtra')}</h3><Link to="/learn">{t('openIt')} →</Link></div></div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section style={{ marginTop: 'var(--s4)' }}>
          <h2>{t('upcoming')}</h2>
          <ul className="list">
            {upcoming.map((d) => {
              const pd = planDay(plan, d);
              return (
                <li key={d} className="card" style={{ padding: 'var(--s3)' }}>
                  <div className="seg-line"><strong>{fill(t('planDayOf'), { d, n: plan.days })}</strong><span className="meta">{pd.date} · {pd.ayahs} {t('ayahsCount')}{dayComplete(plan, d, done) ? ' ✓' : ''}</span></div>
                  <span className="meta">{pd.segments.slice(0, 3).map((s) => `${nameOf(s.surah)} ${range(s)}`).join(' · ')}{pd.segments.length > 3 ? ' …' : ''}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div style={{ marginTop: 'var(--s4)' }}>
        {!confirm ? <button className="btn small ghost" onClick={() => setConfirm(true)}>{t('deletePlan')}</button> : (
          <p className="notice warn" role="alert">{t('confirmDelete')} <button className="btn small" onClick={() => readingStore.setPlan(null)}>{t('deletePlan')}</button> <button className="btn small ghost" onClick={() => setConfirm(false)}>{t('close')}</button></p>
        )}
      </div>
    </>
  );
}

/** Progress: streak, goal, the last 14 days, every surah you started, and the 30 juz. */
function Progress() {
  const { t, lang } = useSettings();
  const { reading, done } = useReading();
  const sum = summarize(done);
  const [chapters] = useAsync(async () => (await api.GET('/api/v1/surahs')).data ?? [], []);
  const nameOf = (id: number) => { const c = chapters.status === 'ready' ? chapters.data.find((x) => x.id === id) : undefined; return c ? surahName(lang, c) : String(id); };
  const days = lastDays(reading.days, 14);
  const max = Math.max(1, reading.goal, ...days.map((d) => d.count));
  const juz = Array.from({ length: 30 }, (_, i) => {
    const segs = juzSegments(i + 1);
    const total = segs.reduce((n, s) => n + s.to - s.from + 1, 0);
    return { j: i + 1, pct: Math.round((100 * readIn(segs, done)) / total) };
  });
  const started = [...sum.perSurah].sort((a, b) => b.read / b.total - a.read / a.total || a.surah - b.surah);

  return (
    <section style={{ marginTop: 'var(--s5)' }}>
      <h2>{t('myProgress')}</h2>
      {sum.totalRead === 0 && <p className="notice" role="status">{t('noProgress')}</p>}
      <div className="stats">
        <div className="stat"><b>🔥 {streak(reading.days)}</b><span>{t('streak')}</span></div>
        <div className="stat"><b>{todayCount(reading)} / {reading.goal}</b><span>{t('todayRead')}</span></div>
        <div className="stat"><b>{sum.totalRead.toLocaleString()}</b><span>{t('totalRead')}</span></div>
        <div className="stat"><b>{sum.percent}%</b><span>{t('ofQuran')}</span></div>
        <div className="stat"><b>{sum.surahsDone}</b><span>{t('surahsDone')}</span></div>
      </div>

      <div className="field" style={{ maxWidth: '24rem' }}>
        <span className="label">{t('goalPerDay')}</span>
        <div className="seg" role="group" aria-label={t('goalPerDay')}>{GOALS.map((g) => <button key={g} aria-pressed={reading.goal === g} onClick={() => readingStore.setGoal(g)}>{g}</button>)}</div>
      </div>

      <h3>{t('last14')}</h3>
      <div className="bars" role="img" aria-label={t('last14')}>
        {days.map((d, i) => <i key={d.date} title={`${d.date}: ${d.count}`} data-has={d.count > 0 || undefined} data-today={i === days.length - 1 || undefined} style={{ height: `${Math.max(4, (100 * d.count) / max)}%` }} />)}
      </div>

      <h3>{t('byJuz')}</h3>
      <div className="juz-cells">{juz.map((c) => <Link key={c.j} to="/" className="juz-cell" style={{ ['--fill' as string]: `${c.pct}%` }} title={`${t('juz')} ${c.j}: ${c.pct}%`} aria-label={`${t('juz')} ${c.j}: ${c.pct}%`}>{c.j}</Link>)}</div>

      {started.length > 0 && (
        <>
          <h3>{t('bySurah')}</h3>
          {started.map((s) => (
            <div key={s.surah} className="surah-prog">
              <Link to={`/surah/${s.surah}`}>{s.surah}. {nameOf(s.surah)}</Link>
              <span className="progress-bar"><i style={{ width: `${(100 * s.read) / s.total}%` }} /></span>
              <span className="meta">{s.read}/{AYAH_COUNTS[s.surah - 1]}</span>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

export default function PlanPage() {
  const { t } = useSettings();
  const { plan, done } = useReading();
  const ph = plan ? planProgress(plan, done) : null;
  return (
    <div>
      <PageHero
        overline={t('myPlan')}
        title={plan && ph ? (ph.day >= 1 && ph.day <= plan.days ? fill(t('planDayOf'), { d: ph.day, n: plan.days }) : ph.status === 'finished' ? t('statusDone') : t('myPlan')) : t('myPlan')}
        sub={plan ? `${plan.startDate} → ${plan.endDate}` : t('planIntro')}
        aside={plan && ph ? <Ring value={ph.read / ph.total} size={112} stroke={10}><b>{Math.round((100 * ph.read) / ph.total)}%</b><small>{ph.read.toLocaleString()}</small></Ring> : <div className="hero-emoji" aria-hidden="true">📅</div>}
      />
      {plan ? <PlanView plan={plan} /> : <Wizard />}
      <Progress />
    </div>
  );
}
