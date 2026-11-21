import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AYAH_COUNTS, juzSegments, planProgress, streak, suggestNext, summarize, surahName, todayCount,
} from '@quran-shikkha/learning-core';
import { api } from '../lib/api';
import { doneFor, readingStore, useReading } from '../lib/readingStore';
import { useAsync } from '../lib/useAsync';
import { useSettings } from '../settings';
import { Async } from '../components/States';
import { Ring } from '../components/Ring';

type Tab = 'surahs' | 'juz';
const fold = (s: string) => s.toLowerCase().replace(/[\s\-'’‘ʿʾ]/g, '');
type Chapter = { id: number; nameSimple: string; nameArabic: string; versesCount: number };

/** Home answers one question: "what do I do now?" Continue where you stopped, today's plan, your saved places, then everything else. */
export default function Home() {
  const { t, lang } = useSettings();
  const { reading, plan, done } = useReading();
  const [tab, setTab] = useState<Tab>('surahs');
  const [q, setQ] = useState('');

  const [state, retry] = useAsync(async () => {
    const [chapters, lessons] = await Promise.all([api.GET('/api/v1/surahs'), api.GET('/api/v1/lessons')]);
    if (!chapters.data) throw new Error('home');
    const familiarId = ((lessons.data ?? []) as { id: number; type: string }[]).find((l) => l.type === 'familiar')?.id;
    return { chapters: chapters.data as Chapter[], familiarId };
  }, []);

  const sum = summarize(done);
  const hasHistory = reading.last !== null || sum.totalRead > 0;
  const next = suggestNext(done);
  const goalDone = todayCount(reading) >= reading.goal;

  return (
    <div className="home">
      <Async state={state} retry={retry}>
        {({ chapters, familiarId }) => {
          const nameOf = (id: number) => { const c = chapters.find((x) => x.id === id); return c ? surahName(lang, c) : String(id); };
          const last = reading.last;
          const lastDone = last ? doneFor(last.surah).length : 0;
          const lastTotal = last ? AYAH_COUNTS[last.surah - 1]! : 0;

          const strk = streak(reading.days);
          const f = fold(q);
          const shown = chapters.filter((c) => !f || String(c.id) === f || fold(surahName(lang, c)).includes(f) || fold(c.nameSimple).includes(f) || c.nameArabic.includes(q.trim()));
          const lastFrac = last ? lastDone / lastTotal : 0;
          const goalFrac = reading.goal ? todayCount(reading) / reading.goal : 0;
          const pp = plan ? planProgress(plan, done) : null;
          const planDayNo = pp && pp.day >= 1 && pp.day <= (plan?.days ?? 0) ? pp.day : null;
          const planLabel = pp ? { 'on-track': t('statusOn'), ahead: t('statusAhead'), behind: t('statusBehind'), 'not-started': t('statusNot'), finished: t('statusDone') }[pp.status] : '';

          return (
            <>
              {/* ── hero ───────────────────────────────────────────── */}
              <section className="hero2" aria-label={last ? t('continueReading') : t('startHere')}>
                <div className="hero2-pattern" aria-hidden="true" />
                <div className="hero2-body">
                  <p className="overline">{t('greet')}</p>
                  <h1 className="hero2-title">{last ? `${t('surah')} ${nameOf(last.surah)}` : t('startFatiha')}</h1>
                  {last
                    ? <p className="hero2-sub">{t('continueFrom')}: <strong>{t('ayah')} {last.ayah}</strong> · {lastDone} / {lastTotal}</p>
                    : <ol className="how how-on-hero"><li>{t('how1')}</li><li>{t('how2')}</li><li>{t('how3')}</li></ol>}
                  <div className="hero2-actions">
                    <Link className="btn-hero" to={last ? `/surah/${last.surah}?from=${last.ayah}` : '/surah/1'}>{last ? t('continueReading') : t('startReading')} <span aria-hidden="true">→</span></Link>
                    {last && next && next !== last.surah && <Link className="btn-hero ghost" to={`/surah/${next}`}>{t('nextUp')}: {nameOf(next)}</Link>}
                  </div>
                </div>
                <div className="hero2-side">
                  {last && <Ring value={lastFrac} size={120} stroke={10}><b>{Math.round(lastFrac * 100)}%</b><small>{nameOf(last.surah)}</small></Ring>}
                  <p className="hero2-ar ar" lang="ar" aria-hidden="true">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>
                </div>
              </section>

              {/* ── your day: three rings ──────────────────────────── */}
              {hasHistory && (
                <section className="rings" aria-label={t('myProgress')}>
                  <div className="ring-card"><Ring value={Math.min(strk, 7) / 7} size={78} stroke={8}><b>🔥</b></Ring><div><strong>{strk}</strong><span>{t('streak')}</span></div></div>
                  <div className="ring-card"><Ring value={Math.min(1, goalFrac)} size={78} stroke={8}><b>{todayCount(reading)}</b></Ring><div><strong>{todayCount(reading)} / {reading.goal}</strong><span>{goalDone ? '✅ ' + t('goalReached') : t('todayRead')}</span></div></div>
                  <div className="ring-card"><Ring value={sum.percent / 100} size={78} stroke={8}><b>{Math.round(sum.percent)}%</b></Ring><div><strong>{sum.totalRead.toLocaleString()}</strong><span>{t('ofQuran')}</span></div></div>
                </section>
              )}

              {/* ── bento ──────────────────────────────────────────── */}
              <p className="overline sect">{t('yourDay')}</p>
              <section className="bento">
                <Link to="/plan" className="b b-plan">
                  <span className="b-icon" aria-hidden="true">📅</span>
                  <strong>{plan && pp ? `${t('todaysPlan')}${planDayNo ? ' · ' + t('planDayOf').replace('%d', String(planDayNo)).replace('%n', String(plan.days)) : ''}` : t('myPlan')}</strong>
                  {plan && pp ? (
                    <>
                      <span className="status" data-s={pp.status}>{planLabel}</span>
                      <span className="progress-bar" aria-hidden="true"><i style={{ width: `${(100 * pp.read) / pp.total}%` }} /></span>
                      <span className="meta">{pp.read.toLocaleString()} / {pp.total.toLocaleString()} {t('ayahsCount')}</span>
                    </>
                  ) : <span className="meta">{t('makePlanCard')}</span>}
                </Link>

                <div className="b b-saved">
                  <span className="b-icon" aria-hidden="true">📌</span>
                  <strong>{t('savedPlaces')}</strong>
                  {reading.bookmarks.length === 0 ? <span className="meta">{t('noSaved')}</span> : (
                    <div className="chips">
                      {reading.bookmarks.slice(0, 6).map((b) => (
                        <span key={`${b.surah}:${b.ayah}`} className="chip-link">
                          <Link to={`/surah/${b.surah}?from=${b.ayah}`} style={{ color: 'inherit', textDecoration: 'none' }}>{nameOf(b.surah)} · {b.ayah}</Link>
                          <button aria-label={t('unpin')} onClick={() => readingStore.togglePin(b.surah, b.ayah)}>✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <Link to="/learn" className="b b-learn"><span className="b-emoji" aria-hidden="true">🍎🐱🚗</span><strong>{t('dailyArabic')}</strong><span className="meta">{t('dailyIntro')}</span></Link>
                <Link to="/watch" className="b b-watch"><span className="b-emoji" aria-hidden="true">📺</span><strong>{t('watchRead')}</strong><span className="meta">{t('watchIntro')}</span></Link>
                <Link to="/practice" className="b b-practice"><span className="b-emoji ar" aria-hidden="true">ا ب ت</span><strong>{t('practice')}</strong><span className="meta">{t('practiceIntro')}</span></Link>
                <Link to="/frequent" className="b b-words"><span className="b-emoji" aria-hidden="true">🔤</span><strong>{t('frequent')}</strong><span className="meta">{t('frequentDesc')}</span></Link>
                {familiarId && <Link to={`/lesson/${familiarId}`} className="b b-fam"><span className="b-emoji" aria-hidden="true">🕌</span><strong>{t('lessonFamiliar')}</strong><span className="meta">{t('familiarIntro')}</span></Link>}
              </section>

              <p className="overline sect">{t('browse')}</p>
              <div className="pills" role="tablist">
                <button className="btn small" role="tab" aria-selected={tab === 'surahs'} aria-pressed={tab === 'surahs'} onClick={() => setTab('surahs')}>{t('tabSurahs')} (114)</button>
                <button className="btn small" role="tab" aria-selected={tab === 'juz'} aria-pressed={tab === 'juz'} onClick={() => setTab('juz')}>{t('tabJuz')} (30)</button>
              </div>
              {tab === 'juz' ? (
                <div className="juz-grid">
                  {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
                    <section key={j} className="card juz-card" aria-label={`${t('juz')} ${j}`}>
                      <h3>{t('juz')} {j}</h3>
                      <ul>{juzSegments(j).map((s) => (
                        <li key={s.surah}><Link to={`/surah/${s.surah}?from=${s.from}`}><span>{s.surah}. {nameOf(s.surah)}</span><span className="meta">{s.from}–{s.to}</span></Link></li>
                      ))}</ul>
                    </section>
                  ))}
                </div>
              ) : (
                <>
                  <input className="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchSurah')} aria-label={t('searchSurah')} />
                  <ul className="list" style={{ marginTop: 'var(--s3)' }}>
                    {shown.map((c) => {
                      const d = (done[c.id] ?? []).length;
                      return (
                        <li key={c.id}>
                          <Link to={`/surah/${c.id}`} className="surah-row">
                            <span className="num">{c.id}</span>
                            <span><span className="surah-name" lang={lang === 'ar' ? 'ar' : undefined}>{surahName(lang, c)}</span><br /><span className="meta">{c.versesCount || AYAH_COUNTS[c.id - 1]} {t('ayahsCount')}{d ? ` · ✓ ${d}` : ''}</span></span>
                            {lang !== 'ar' ? <span className="surah-ar" lang="ar">{c.nameArabic}</span> : <span />}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  {shown.length === 0 && <p className="state">{t('empty')}</p>}
                </>
              )}
            </>
          );
        }}
      </Async>
    </div>
  );
}
