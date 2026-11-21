import { useMemo, useState } from 'react';
import { VOCAB, makeLookup, pickByLang, type LookupEntry, type LookupHit } from '@quran-shikkha/learning-core';
import type { components } from '@quran-shikkha/api-client';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useSettings } from '../settings';
import { Async } from '../components/States';
import { PageHero } from '../components/PageHero';

type Media = components['schemas']['MediaItem'];
type News = components['schemas']['NewsItem'];

/** Click-to-play: nothing is loaded from YouTube until you press play (privacy-friendly embed, no tracking cookies before that). */
function Video({ m }: { m: Media }) {
  const { t } = useSettings();
  const [on, setOn] = useState(false);
  return (
    <article className="video-card">
      <div className="video-frame">
        {on ? (
          <iframe title={m.title} src={`https://www.youtube-nocookie.com/embed/${m.videoId}?autoplay=1&rel=0`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        ) : (
          <button onClick={() => setOn(true)} aria-label={`${t('playVideo')}: ${m.title}`} style={{ backgroundImage: `url(https://i.ytimg.com/vi/${m.videoId}/hqdefault.jpg)` }}>▶</button>
        )}
      </div>
      <div className="video-meta">
        <strong>{m.title}</strong>
        <span className="meta">{m.channel}{m.topic ? ` · ${m.topic}` : ''}</span>
        <a className="meta" href={`https://www.youtube.com/watch?v=${m.videoId}`} target="_blank" rel="noopener noreferrer">YouTube ↗</a>
      </div>
    </article>
  );
}

function Videos() {
  const { t, age } = useSettings();
  const [group, setGroup] = useState<'kids' | 'adults'>(age === 'kids' ? 'kids' : 'adults');
  const [state, retry] = useAsync(async () => {
    const r = await api.GET('/api/v1/media', { params: { query: { age: group } } });
    if (!r.data) throw new Error('media');
    return r.data;
  }, [group]);
  return (
    <>
      <div className="seg" role="group" style={{ maxWidth: '30rem', margin: 'var(--s3) 0' }}>
        <button aria-pressed={group === 'kids'} onClick={() => setGroup('kids')}>🧒 {t('kidsVideos')}</button>
        <button aria-pressed={group === 'adults'} onClick={() => setGroup('adults')}>{t('adultVideos')}</button>
      </div>
      {group === 'kids' && <p className="notice warn" role="note">{t('parentNote')}</p>}
      <Async state={state} retry={retry}>{(items) => <div className="video-grid">{items.map((m) => <Video key={m.id} m={m} />)}</div>}</Async>
    </>
  );
}

/** One lookup for the whole page: daily words first, then the ~1000 most common Quran words. */
let lookupPromise: Promise<(t: string) => LookupHit | null> | null = null;
function loadLookup() {
  lookupPromise ??= (async () => {
    const entries: LookupEntry[] = VOCAB.filter((w) => !w.ar.includes(' ')).map((w) => ({ ar: w.ar, bn: w.bn, en: w.en, source: 'daily' }));
    try {
      const r = await api.GET('/api/v1/tracks/frequent', { params: { query: { size: 1000 } } });
      for (const w of r.data?.words ?? []) entries.push({ ar: w.arabicText, bn: w.meaningBn ?? '', en: w.meaningEn ?? '', source: 'quran' });
    } catch { /* daily words alone still work */ }
    return makeLookup(entries);
  })();
  return lookupPromise;
}

function Headline({ item, lookup }: { item: News; lookup: ((t: string) => LookupHit | null) | null }) {
  const { t, lang } = useSettings();
  const [sel, setSel] = useState<{ token: string; hit: LookupHit | null } | null>(null);
  const parts = item.title.split(/(\s+)/);
  const hit = sel?.hit;
  return (
    <article className="news-item">
      <p className="headline" lang="ar" dir="rtl">
        {parts.map((p, i) => {
          if (/^\s+$/.test(p)) return p;
          const h = lookup?.(p) ?? null;
          return <button key={i} className="hw" data-known={h ? true : undefined} data-on={sel?.token === p || undefined} onClick={() => setSel({ token: p, hit: h })}>{p}</button>;
        })}
      </p>
      {sel && (
        <div className="news-chip" role="status">
          <strong className="ar" lang="ar">{sel.token}</strong> ·{' '}
          {hit ? <>{t('likelyMeaning')}: <b>{pickByLang(lang, hit.bn || null, hit.en || null) ?? ''}</b> <span className="meta">({hit.source === 'daily' ? t('fromDaily') : t('fromQuran')})</span></> : <span className="meta">{t('wordNotKnown')}</span>}
        </div>
      )}
      <div className="links">
        <span className="meta">{item.source}{item.published ? ` · ${new Date(item.published).toLocaleDateString()}` : ''}</span>
        <a href={item.link} target="_blank" rel="noopener noreferrer">{t('openSource')} ↗</a>
        <a href={`https://translate.google.com/?sl=ar&tl=${lang === 'bn' ? 'bn' : 'en'}&text=${encodeURIComponent(item.title)}&op=translate`} target="_blank" rel="noopener noreferrer">{t('translateLink')} ↗</a>
      </div>
    </article>
  );
}

function NewsPortal() {
  const { t } = useSettings();
  const [source, setSource] = useState('bbc');
  const [srcState] = useAsync(async () => (await api.GET('/api/v1/news/sources')).data ?? [], []);
  const [lk] = useAsync(loadLookup, []);
  const lookup = useMemo(() => (lk.status === 'ready' ? lk.data : null), [lk]);
  const [state, retry] = useAsync(async () => {
    const r = await api.GET('/api/v1/news', { params: { query: { source } } });
    if (!r.data) throw new Error('news');
    return r.data;
  }, [source]);
  return (
    <>
      {srcState.status === 'ready' && (
        <div className="seg" role="group" style={{ maxWidth: '34rem', margin: 'var(--s3) 0' }}>
          {srcState.data.map((s) => <button key={s.key} aria-pressed={source === s.key} onClick={() => setSource(s.key)}>{s.name}</button>)}
        </div>
      )}
      <p className="hint">{t('newsTap')}</p>
      <p className="hint small-note">{t('newsNote')}</p>
      <Async state={state} retry={retry}>{(items) => <>{items.map((n) => <Headline key={n.link} item={n} lookup={lookup} />)}</>}</Async>
    </>
  );
}

export default function Watch() {
  const { t } = useSettings();
  const [tab, setTab] = useState<'videos' | 'news'>('videos');
  return (
    <div>
      <PageHero compact overline={t('watchRead')} title={t('watchRead')} sub={t('watchIntro')} aside={<div className="hero-emoji" aria-hidden="true">📺 📰</div>} />
      <div className="pills" role="tablist">
        <button className="btn small" role="tab" aria-selected={tab === 'videos'} aria-pressed={tab === 'videos'} onClick={() => setTab('videos')}>📺 {t('videos')}</button>
        <button className="btn small" role="tab" aria-selected={tab === 'news'} aria-pressed={tab === 'news'} onClick={() => setTab('news')}>📰 {t('news')}</button>
      </div>
      {tab === 'videos' ? <Videos /> : <NewsPortal />}
    </div>
  );
}
