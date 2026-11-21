import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { VOCAB, makeLookup, pickByLang, type LookupEntry, type LookupHit } from '@quran-shikkha/learning-core';
import { api } from '../api';
import { useAsync } from '../useAsync';
import { useSettings } from '../settings';
import { Async, Btn, Card, T } from '../components/Ui';

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

/** Videos open in YouTube (we never copy or re-host them). News are headlines from each outlet's own public feed. */
export default function Watch() {
  const { t, lang, age, colors: c } = useSettings();
  const [tab, setTab] = useState<'videos' | 'news'>('videos');
  const [group, setGroup] = useState<'kids' | 'adults'>(age === 'kids' ? 'kids' : 'adults');
  const [source, setSource] = useState('bbc');
  const [sel, setSel] = useState<{ id: string; token: string; hit: LookupHit | null } | null>(null);

  const [videos, retryV] = useAsync(async () => { const r = await api.GET('/api/v1/media', { params: { query: { age: group } } }); if (!r.data) throw new Error('m'); return r.data; }, [group]);
  const [sources] = useAsync(async () => (await api.GET('/api/v1/news/sources')).data ?? [], []);
  const [lk] = useAsync(loadLookup, []);
  const lookup = useMemo(() => (lk.status === 'ready' ? lk.data : null), [lk]);
  const [news, retryN] = useAsync(async () => { const r = await api.GET('/api/v1/news', { params: { query: { source } } }); if (!r.data) throw new Error('n'); return r.data; }, [source]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 90 }}>
      <T bold style={{ fontSize: 22 }}>{t('watchRead')}</T>
      <T style={{ color: c.muted }}>{t('watchIntro')}</T>
      <View style={{ flexDirection: 'row' }}>
        <Btn kind={tab === 'videos' ? 'primary' : 'normal'} label={`📺 ${t('videos')}`} onPress={() => setTab('videos')} />
        <Btn kind={tab === 'news' ? 'primary' : 'normal'} label={`📰 ${t('news')}`} onPress={() => setTab('news')} />
      </View>

      {tab === 'videos' ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Btn kind={group === 'kids' ? 'primary' : 'normal'} label={`🧒 ${t('kidsVideos')}`} onPress={() => setGroup('kids')} />
            <Btn kind={group === 'adults' ? 'primary' : 'normal'} label={t('adultVideos')} onPress={() => setGroup('adults')} />
          </View>
          {group === 'kids' && <View style={{ backgroundColor: c.warn, borderRadius: 8, padding: 10 }}><T style={{ fontSize: 13 }}>{t('parentNote')}</T></View>}
          <Async state={videos} retry={retryV}>
            {(items) => <View>{items.map((m) => (
              <Pressable key={m.id} accessibilityRole="link" accessibilityLabel={m.title} onPress={() => void Linking.openURL(`https://www.youtube.com/watch?v=${m.videoId}`)}>
                <Card><T bold>▶ {m.title}</T><T style={{ color: c.muted, fontSize: 13 }}>{m.channel} · {m.topic}</T></Card>
              </Pressable>))}</View>}
          </Async>
        </>
      ) : (
        <>
          {sources.status === 'ready' && <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{sources.data.map((s) => <Btn key={s.key} kind={source === s.key ? 'primary' : 'normal'} label={s.name} onPress={() => setSource(s.key)} />)}</View>}
          <T style={{ color: c.muted, fontSize: 13 }}>{t('newsTap')}</T>
          <Async state={news} retry={retryN}>
            {(items) => <View>{items.map((n) => {
              const parts = n.title.split(/(\s+)/);
              return (
                <Card key={n.link}>
                  <Text style={{ fontFamily: 'AmiriQuran_400Regular', fontSize: 24, lineHeight: 50, color: c.text, writingDirection: 'rtl', textAlign: 'right' }}>
                    {parts.map((p, i) => /^\s+$/.test(p) ? p : <Text key={i} onPress={() => setSel({ id: n.link, token: p, hit: lookup?.(p) ?? null })} style={sel?.id === n.link && sel.token === p ? { backgroundColor: c.hl } : undefined}>{p}</Text>)}
                  </Text>
                  {sel?.id === n.link && <View style={{ backgroundColor: c.surface2, borderRadius: 10, padding: 8 }}><T style={{ fontSize: 14 }}>{sel.token} · {sel.hit ? `${t('likelyMeaning')}: ${pickByLang(lang, sel.hit.bn || null, sel.hit.en || null) ?? ''}` : t('wordNotKnown')}</T></View>}
                  <T style={{ color: c.muted, fontSize: 12 }}>{n.source}</T>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    <Btn kind="ghost" label={`${t('openSource')} ↗`} onPress={() => void Linking.openURL(n.link)} />
                    <Btn kind="ghost" label={`${t('translateLink')} ↗`} onPress={() => void Linking.openURL(`https://translate.google.com/?sl=ar&tl=${lang === 'bn' ? 'bn' : 'en'}&text=${encodeURIComponent(n.title)}&op=translate`)} />
                  </View>
                </Card>
              );
            })}</View>}
          </Async>
        </>
      )}
    </ScrollView>
  );
}
