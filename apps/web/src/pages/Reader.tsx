import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { surahName } from '@quran-shikkha/learning-core';
import { api, authed } from '../lib/api';
import { load, save } from '../lib/storage';
import { useAsync } from '../lib/useAsync';
import { useWordInteraction } from '../lib/useWordInteraction';
import { useSettings } from '../settings';
import { AyahBlock, type Step } from '../components/AyahBlock';
import { DetailsSheet } from '../components/DetailsSheet';
import { Async } from '../components/States';
import { SoundHint } from '../components/SoundHint';

const PAGE = 15; // ayahs per page: keeps Al-Baqarah (286 ayahs) fast

export default function Reader() {
  const { n } = useParams();
  const [params] = useSearchParams();
  const surah = Number(n);
  const { t, lang } = useSettings();
  const wi = useWordInteraction();
  const [details, setDetails] = useState<number | null>(null);
  const [steps, setSteps] = useState<Record<string, Set<Step>>>({});
  const [done, setDone] = useState<number[]>(() => load<number[]>(`qs.done.${surah}`, []));
  const [page, setPage] = useState(() => Math.max(0, Math.floor((Number(params.get('from') ?? 1) - 1) / PAGE)));

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
  const [tr] = useAsync(async () => {
    const r = await api.GET('/api/v1/surahs/{n}/translations', { params: { path: { n: surah }, query: { lang } } });
    return r.data ?? null;
  }, [surah, lang]);
  const trMap = useMemo(() => new Map(tr.status === 'ready' && tr.data ? tr.data.ayahs.map((a) => [a.ayah, a.text]) : []), [tr]);
  const trSource = tr.status === 'ready' ? tr.data : null;

  useEffect(() => {
    setDone(load<number[]>(`qs.done.${surah}`, []));
    wi.clear(); setSteps({}); setDetails(null);
    setPage(Math.max(0, Math.floor((Number(params.get('from') ?? 1) - 1) / PAGE)));
  }, [surah]); // eslint-disable-line react-hooks/exhaustive-deps

  // arriving from a juz link (?from=142): bring that ayah into view once the page is drawn
  useEffect(() => {
    const from = Number(params.get('from'));
    if (state.status === 'ready' && from > 1) setTimeout(() => document.getElementById(`a${from}`)?.scrollIntoView({ block: 'start' }), 60);
  }, [state.status, surah]); // eslint-disable-line react-hooks/exhaustive-deps

  const addStep = useCallback((key: string, s: Step) => setSteps((o) => (o[key]?.has(s) ? o : { ...o, [key]: new Set([...(o[key] ?? []), s]) })), []);

  const complete = (ayah: number, lessonId: number | null) => {
    const next = Array.from(new Set([...done, ayah]));
    setDone(next);
    save(`qs.done.${surah}`, next);
    if (lessonId !== null)
      void authed(() => api.PUT('/api/v1/progress/{lessonId}', { params: { path: { lessonId } }, body: { completedItems: next.length } })).catch(() => undefined);
  };

  if (!Number.isInteger(surah) || surah < 1 || surah > 114) return <p className="state">{t('empty')}</p>;

  return (
    <div>
      <Async state={state} retry={retry}>
        {({ ayahs, chapter, lessonId }) => {
          const pages = Math.ceil(ayahs.length / PAGE);
          const slice = ayahs.slice(page * PAGE, page * PAGE + PAGE);
          const go = (p: number) => { setPage(p); wi.clear(); window.scrollTo({ top: 0 }); };
          const pager = pages > 1 && (
            <nav className="pager" aria-label={t('page')}>
              <button className="btn small" disabled={page === 0} onClick={() => go(page - 1)}>← {t('prev')}</button>
              <span className="meta">{t('page')} {page + 1} / {pages} · {t('ayah')} {page * PAGE + 1}–{Math.min(ayahs.length, page * PAGE + PAGE)}</span>
              <button className="btn small" disabled={page >= pages - 1} onClick={() => go(page + 1)}>{t('next')} →</button>
            </nav>
          );
          return (
            <>
              <div className="surah-head">
                <h1>{lang === 'ar' && chapter ? chapter.nameArabic : `${t('surah')} ${chapter ? surahName(lang, chapter) : surah}`}</h1>
                {lang !== 'ar' && <span className="ar" lang="ar">{chapter?.nameArabic}</span>}
              </div>
              <div className="reader-meta">
                <span className="meta" aria-live="polite">{t('progress')}: {done.length} / {ayahs.length}</span>
                <span className="progress-bar" aria-hidden="true"><i style={{ width: `${(100 * done.length) / Math.max(1, ayahs.length)}%` }} /></span>
                <Link className="btn small" to={`/surah/${surah}/tafsir`}>📜 {t('surahTafsir')}</Link>
              </div>
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
                  onStep={(s) => addStep(a.key, s)}
                  onComplete={() => complete(a.ayah, lessonId)}
                  onTap={wi.tap}
                  onBreak={(w) => void wi.breakDown(w)}
                  onListen={(w) => void wi.listen(w)}
                  onHover={wi.hover}
                  onClose={wi.clear}
                  onDetails={() => setDetails(a.ayah)}
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
