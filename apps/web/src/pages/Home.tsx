import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AYAH_COUNTS, juzSegments, surahName } from '@quran-shikkha/learning-core';
import { api } from '../lib/api';
import { load } from '../lib/storage';
import { useAsync } from '../lib/useAsync';
import { useSettings } from '../settings';
import { Async } from '../components/States';

type Tab = 'surahs' | 'juz';
const fold = (s: string) => s.toLowerCase().replace(/[\s\-'’‘ʿʾ]/g, '');

export default function Home() {
  const { t, lang } = useSettings();
  const [tab, setTab] = useState<Tab>('surahs');
  const [q, setQ] = useState('');

  const [state, retry] = useAsync(async () => {
    const [chapters, lessons] = await Promise.all([api.GET('/api/v1/surahs'), api.GET('/api/v1/lessons')]);
    if (!chapters.data) throw new Error('home');
    const familiar = ((lessons.data ?? []) as { id: number; type: string }[]).find((l) => l.type === 'familiar')?.id;
    return { chapters: chapters.data, familiarId: familiar };
  }, []);

  return (
    <div>
      <section className="hero">
        <h1>{t('appName')}</h1>
        <p className="hint">{t('loop')}</p>
      </section>

      <h2>{t('startHere')}</h2>
      <div className="start-grid">
        <Link to="/surah/1" className="start-card"><strong>{t('pathTitle')}</strong><span className="meta">{t('pathDesc')}</span></Link>
        <Async state={state} retry={retry}>
          {(d) => d.familiarId ? <Link to={`/lesson/${d.familiarId}`} className="start-card"><strong>{t('lessonFamiliar')}</strong><span className="meta">{t('familiarIntro')}</span></Link> : <></>}
        </Async>
        <Link to="/frequent" className="start-card"><strong>{t('frequent')}</strong><span className="meta">{t('frequentDesc')}</span></Link>
        <Link to="/practice" className="start-card"><strong>{t('practice')}</strong><span className="meta">{t('practiceIntro')}</span></Link>
      </div>

      <h2>{t('browse')}</h2>
      <div className="pills" role="tablist">
        <button className="btn small" role="tab" aria-selected={tab === 'surahs'} aria-pressed={tab === 'surahs'} onClick={() => setTab('surahs')}>{t('tabSurahs')} (114)</button>
        <button className="btn small" role="tab" aria-selected={tab === 'juz'} aria-pressed={tab === 'juz'} onClick={() => setTab('juz')}>{t('tabJuz')} (30)</button>
      </div>

      <Async state={state} retry={retry}>
        {({ chapters }) => {
          const nameOf = (id: number) => { const c = chapters.find((x) => x.id === id); return c ? surahName(lang, c) : String(id); };
          if (tab === 'juz') {
            return (
              <div className="juz-grid">
                {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
                  <section key={j} className="card juz-card" aria-label={`${t('juz')} ${j}`}>
                    <h3>{t('juz')} {j}</h3>
                    <ul>
                      {juzSegments(j).map((s) => (
                        <li key={s.surah}>
                          <Link to={`/surah/${s.surah}?from=${s.from}`}><span>{s.surah}. {nameOf(s.surah)}</span><span className="meta">{s.from}–{s.to}</span></Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            );
          }
          const f = fold(q);
          const shown = chapters.filter((c) => !f || String(c.id) === f || fold(surahName(lang, c)).includes(f) || fold(c.nameSimple).includes(f) || c.nameArabic.includes(q.trim()));
          return (
            <>
              <input className="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchSurah')} aria-label={t('searchSurah')} />
              <ul className="list" style={{ marginTop: 'var(--s3)' }}>
                {shown.map((c) => {
                  const done = load<number[]>(`qs.done.${c.id}`, []).length;
                  return (
                    <li key={c.id}>
                      <Link to={`/surah/${c.id}`} className="surah-row">
                        <span className="num">{c.id}</span>
                        <span><span className="surah-name" lang={lang === 'ar' ? 'ar' : undefined}>{surahName(lang, c)}</span><br /><span className="meta">{c.versesCount || AYAH_COUNTS[c.id - 1]} {t('ayahsCount')}{done ? ` · ✓ ${done}` : ''}</span></span>
                        {lang !== 'ar' ? <span className="surah-ar" lang="ar">{c.nameArabic}</span> : <span />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {shown.length === 0 && <p className="state">{t('empty')}</p>}
            </>
          );
        }}
      </Async>
    </div>
  );
}
