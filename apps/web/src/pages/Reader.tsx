import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { isBookmarked, surahName } from '@quran-shikkha/learning-core';
import { api, authed } from '../lib/api';
import { doneFor, readingStore, useReading } from '../lib/readingStore';
import { useAsync } from '../lib/useAsync';
import { useWordInteraction } from '../lib/useWordInteraction';
import { useSettings } from '../settings';
import { AyahBlock, type Step } from '../components/AyahBlock';
import { DetailsSheet } from '../components/DetailsSheet';
import { Async } from '../components/States';
import { SoundHint } from '../components/SoundHint';
import { PageHero } from '../components/PageHero';
import { Ring } from '../components/Ring';

const PAGE = 15; // ayahs per page: keeps Al-Baqarah (286 ayahs) fast
const pageOf = (ayah: number) => Math.max(0, Math.floor((ayah - 1) / PAGE));

export default function Reader() {
  const { n } = useParams();
  const [params] = useSearchParams();
  const surah = Number(n);
  const { t, lang } = useSettings();
  const wi = useWordInteraction();
  const { reading } = useReading();
  const [details, setDetails] = useState<number | null>(null);
  const [steps, setSteps] = useState<Record<string, Set<Step>>>({});
  const from = Number(params.get('from') ?? 0);
  const [page, setPage] = useState(() => pageOf(from || 1));
  const done = doneFor(surah);

  const [state, retry] = useAsync(async () => {
    const [ayahs, surahs, lessons] = await Promise.all([
      api.GET('/api/v1/surahs/{n}/ayahs', { params: { path: { n: surah } } }),
      api.GET('/api/v1/surahs'),
      api.GET('/api/v1/lessons'),
    ]);
    if (!ayahs.data) throw new Error('ayahs');
    const lessonId = ((lessons.data ?? []) as { id: number; ayahRange?: string | null }[]).find((l) => l.ayahRange?.startsWith(`${surah}:`))?.id ?? null;
    return { ayahs: ayahs.data, chapter: surahs.data?.find((c) => c.id === surah), lessonId };
  }, [surah]);

  // The meaning of every ayah in the reader's language. Optional: if it fails the Arabic still shows.
  const [tr] = useAsync(async () => (await api.GET('/api/v1/surahs/{n}/translations', { params: { path: { n: surah }, query: { lang } } })).data ?? null, [surah, lang]);
  const trMap = useMemo(() => new Map(tr.status === 'ready' && tr.data ? tr.data.ayahs.map((a) => [a.ayah, a.text]) : []), [tr]);
  const trSource = tr.status === 'ready' ? tr.data : null;

  useEffect(() => { wi.clear(); setSteps({}); setDetails(null); setPage(pageOf(from || 1)); }, [surah]); // eslint-disable-line react-hooks/exhaustive-deps

  // arriving from a juz / plan / continue link (?from=142): bring that ayah into view once the page is drawn
  useEffect(() => {
    if (state.status === 'ready' && from > 1) setTimeout(() => document.getElementById(`a${from}`)?.scrollIntoView({ block: 'start' }), 60);
  }, [state.status, surah]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Doing anything with an ayah (listen, tap, break down) also moves "where I stopped" to it. */
  const addStep = useCallback((key: string, ayah: number, s: Step) => {
    if (s !== 'read') readingStore.setLast(surah, ayah); // "I read it" moves the place forward itself (markRead); it must never pull it back
    setSteps((o) => (o[key]?.has(s) ? o : { ...o, [key]: new Set([...(o[key] ?? []), s]) }));
  }, [surah]);

  const markRead = (ayah: number, lessonId: number | null) => {
    readingStore.markRead(surah, ayah);
    if (lessonId !== null)
      void authed(() => api.PUT('/api/v1/progress/{lessonId}', { params: { path: { lessonId } }, body: { completedItems: doneFor(surah).length } })).catch(() => undefined);
  };

  if (!Number.isInteger(surah) || surah < 1 || surah > 114) return <p className="state">{t('empty')}</p>;
  const last = reading.last;
  const showResume = last && last.surah === surah && last.ayah > 1 && !from;

  return (
    <div>
      <Async state={state} retry={retry}>
        {({ ayahs, chapter, lessonId }) => {
          const pages = Math.ceil(ayahs.length / PAGE);
          const slice = ayahs.slice(page * PAGE, page * PAGE + PAGE);
          const go = (p: number) => { setPage(p); wi.clear(); readingStore.setLast(surah, p * PAGE + 1); window.scrollTo({ top: 0 }); };
          const pager = pages > 1 && (
            <nav className="pager" aria-label={t('page')}>
              <button className="btn small" disabled={page === 0} onClick={() => go(page - 1)}>← {t('prev')}</button>
              <span className="meta">{t('page')} {page + 1} / {pages} · {t('ayah')} {page * PAGE + 1}–{Math.min(ayahs.length, page * PAGE + PAGE)}</span>
              <button className="btn small" disabled={page >= pages - 1} onClick={() => go(page + 1)}>{t('next')} →</button>
            </nav>
          );
          return (
            <>
              <PageHero
                overline={`${t('surah')} ${surah}`}
                title={lang === 'ar' && chapter ? chapter.nameArabic : chapter ? surahName(lang, chapter) : String(surah)}
                sub={<span aria-live="polite">{t('progress')}: {done.length} / {ayahs.length} {t('ayahsCount')}</span>}
                aside={(
                  <>
                    <Ring value={done.length / Math.max(1, ayahs.length)} size={104} stroke={9}><b>{Math.round((100 * done.length) / Math.max(1, ayahs.length))}%</b></Ring>
                    {lang !== 'ar' && <p className="hero-name-ar ar" lang="ar">{chapter?.nameArabic}</p>}
                  </>
                )}
              >
                <div className="hero-links"><Link className="btn-hero ghost" to={`/surah/${surah}/tafsir`}>📜 {t('surahTafsir')}</Link></div>
              </PageHero>
              {showResume && (
                <div className="resume">
                  <span>{t('continueFrom')}: <strong>{t('ayah')} {last!.ayah}</strong></span>
                  <button className="btn small primary" onClick={() => { setPage(pageOf(last!.ayah)); setTimeout(() => document.getElementById(`a${last!.ayah}`)?.scrollIntoView({ block: 'start' }), 80); }}>{t('continueReading')} →</button>
                </div>
              )}
              <p className="hint">{t('tapHint')}</p>
              <p className="hint">{t('disclaimer')}</p>
              {trSource && <p className="src">{t('meaningLang')}: {trSource.source}{trSource.version ? ` · ${t('version')} ${trSource.version}` : ''}</p>}
              {pager}
              {slice.map((a) => (
                <AyahBlock
                  key={a.key}
                  ayah={a}
                  translation={trMap.has(a.ayah) ? { text: trMap.get(a.ayah)!, source: trSource?.source ?? '' } : null}
                  selected={wi.selected}
                  breakdown={wi.breakdown}
                  notice={wi.notice}
                  steps={steps[a.key] ?? new Set()}
                  completed={done.includes(a.ayah)}
                  pinned={isBookmarked(reading, surah, a.ayah)}
                  onPin={() => readingStore.togglePin(surah, a.ayah)}
                  onStep={(s) => addStep(a.key, a.ayah, s)}
                  onComplete={() => markRead(a.ayah, lessonId)}
                  onTap={wi.tap}
                  onBreak={(w) => void wi.breakDown(w)}
                  onListen={(w) => void wi.listen(w)}
                  onHover={wi.hover}
                  onClose={wi.clear}
                  onDetails={() => { readingStore.setLast(surah, a.ayah); setDetails(a.ayah); }}
                />
              ))}
              {pager}
              {details !== null && <DetailsSheet surah={surah} ayah={details} onClose={() => setDetails(null)} />}
            </>
          );
        }}
      </Async>
      <SoundHint />
    </div>
  );
}
