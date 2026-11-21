import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LANGS, dirOf, surahName, type Lang } from '@quran-shikkha/learning-core';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useSettings } from '../settings';
import { Async } from '../components/States';
import { TafsirText } from '../components/TafsirText';

const PAGE = 5; // tafsir texts are long, so few ayahs per page

/** Every ayah of a surah with its meaning and tafsir, in the language you choose. */
export default function TafsirPage() {
  const { n } = useParams();
  const surah = Number(n);
  const { t, lang } = useSettings();
  const [tLang, setTLang] = useState<Lang>(lang);
  const [page, setPage] = useState(0);

  const [state, retry] = useAsync(async () => {
    const [ayahs, chapters, tafsir, trans] = await Promise.all([
      api.GET('/api/v1/surahs/{n}/ayahs', { params: { path: { n: surah } } }),
      api.GET('/api/v1/surahs'),
      api.GET('/api/v1/surahs/{n}/tafsir', { params: { path: { n: surah }, query: { lang: tLang } } }),
      api.GET('/api/v1/surahs/{n}/translations', { params: { path: { n: surah }, query: { lang: tLang } } }),
    ]);
    if (!ayahs.data) throw new Error('ayahs');
    return { ayahs: ayahs.data, chapter: chapters.data?.find((c) => c.id === surah), tafsir: tafsir.data ?? null, trans: trans.data ?? null };
  }, [surah, tLang]);

  const tafMap = useMemo(() => new Map(state.status === 'ready' && state.data.tafsir ? state.data.tafsir.ayahs.map((a) => [a.ayah, a.text]) : []), [state]);
  const trMap = useMemo(() => new Map(state.status === 'ready' && state.data.trans ? state.data.trans.ayahs.map((a) => [a.ayah, a.text]) : []), [state]);

  return (
    <div>
      <Link className="back" to={`/surah/${surah}`}>← {t('surah')}</Link>
      <Async state={state} retry={retry}>
        {({ ayahs, chapter, tafsir }) => {
          const pages = Math.ceil(ayahs.length / PAGE);
          const slice = ayahs.slice(page * PAGE, page * PAGE + PAGE);
          return (
            <>
              <h1>{t('tafsir')} · {lang === 'ar' && chapter ? chapter.nameArabic : `${t('surah')} ${chapter ? surahName(lang, chapter) : surah}`}</h1>
              <div className="field" style={{ maxWidth: '24rem' }}>
                <span className="label">{t('tafsirLang')}</span>
                <div className="seg" role="group" aria-label={t('tafsirLang')}>
                  {LANGS.map((l) => <button key={l.code} aria-pressed={tLang === l.code} onClick={() => { setTLang(l.code); setPage(0); }}>{l.label}</button>)}
                </div>
              </div>
              {tafsir && <p className="src">{t('source')}: {tafsir.source}{tafsir.attribution ? ` · ${tafsir.attribution}` : ''}</p>}
              {!tafsir && <p className="state">{t('noTafsirLang')}</p>}
              {slice.map((a) => {
                const arabic = a.words.filter((w) => w.charType === 'word').map((w) => w.arabicText).join(' ');
                return (
                  <article key={a.key} className="card tafsir-card" id={`a${a.ayah}`}>
                    <div className="ayah-head"><span className="num">{a.ayah}</span></div>
                    <div className="zone zone-ar" dir="rtl" lang="ar"><span className="zone-tag" aria-hidden="true">العربية</span><p className="ar">{arabic}</p></div>
                    {trMap.get(a.ayah) && <div className="zone zone-tr" dir={dirOf(tLang)} lang={tLang} style={{ marginTop: 'var(--s2)' }}><p>{trMap.get(a.ayah)}</p></div>}
                    <h3>{t('tafsir')}</h3>
                    {tafMap.get(a.ayah) ? <TafsirText text={tafMap.get(a.ayah)!} lang={tLang} /> : <p className="meta">{tafsir ? t('tafsirTogether') : ''}</p>}
                  </article>
                );
              })}
              {pages > 1 && (
                <nav className="pager" aria-label={t('page')}>
                  <button className="btn small" disabled={page === 0} onClick={() => { setPage(page - 1); window.scrollTo({ top: 0 }); }}>← {t('prev')}</button>
                  <span className="meta">{t('page')} {page + 1} / {pages}</span>
                  <button className="btn small" disabled={page >= pages - 1} onClick={() => { setPage(page + 1); window.scrollTo({ top: 0 }); }}>{t('next')} →</button>
                </nav>
              )}
            </>
          );
        }}
      </Async>
    </div>
  );
}
