import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { Word } from '@quran-shikkha/api-client';
import { dirOf, friendlyLatin, isBookmarked, LANGS, pickByLang, pronScript, pronText, surahName } from '@quran-shikkha/learning-core';
import { api, authed } from '../api';
import { deleteSurah, downloadSurah, listDownloads } from '../offline';
import { pron } from '../pron';
import { readingStore, useReading } from '../readingStore';
import { useAsync } from '../useAsync';
import { useSettings } from '../settings';
import { useWordInteraction } from '../useWordInteraction';
import { DetailsModal } from '../components/DetailsModal';
import { WordView } from '../components/WordView';
import { Async, Btn, Card, T } from '../components/Ui';
import type { Nav } from '../nav';

const PAGE = 15; // ayahs per page: keeps long surahs fast

function Chip({ word, notice, wi }: { word: Word; notice: string; wi: ReturnType<typeof useWordInteraction> }) {
  const { t, lang, colors: c } = useSettings();
  const [added, setAdded] = useState(false);
  const [err, setErr] = useState(false);
  const p = pron(word.arabicText);
  const meaning = pickByLang(lang, word.meaningBn, word.meaningEn);
  return (
    <View style={{ borderWidth: 2, borderColor: c.accent, borderRadius: 14, padding: 12, marginVertical: 6, backgroundColor: c.surface }} accessibilityLiveRegion="polite">
      <T bold>{pronText(p, lang)}{pronScript(lang) === 'bn' ? '  ' : ''}{pronScript(lang) === 'bn' && <T style={{ color: c.muted, fontSize: 13 }}>{friendlyLatin(p.latin)}</T>}</T>
      <T>{meaning ?? t('noMeaning')}</T>
      {!!notice && <T style={{ fontSize: 14, color: c.muted }}>{notice}</T>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Btn label={`🔊 ${t('listen')}`} onPress={() => void wi.listen(word)} />
        <Btn label={`✂ ${t('breakdown')}`} onPress={() => void wi.breakDown(word)} />
        <Btn label={added ? `✓ ${t('cardAdded')}` : `＋ ${t('addCard')}`} disabled={added} onPress={() => { setErr(false); void authed(() => api.POST('/api/v1/flashcards', { body: { wordKey: word.key } })).then((r) => (r.response.ok ? setAdded(true) : setErr(true)), () => setErr(true)); }} />
        <Btn kind="ghost" label={t('close')} onPress={wi.clear} />
      </View>
      {err && <T style={{ fontSize: 14 }}>{t('errorBody')}</T>}
    </View>
  );
}

/** Arabic reads right-to-left, the meaning left-to-right (right-to-left for Arabic UI): two separate zones, each tagged at its own start. */
export default function Reader({ surah, from, open }: { surah: number; from?: number; open: (s: Nav) => void }) {
  const { t, lang, wordMeanings, colors: c } = useSettings();
  const wi = useWordInteraction(surah);
  const [details, setDetails] = useState<number | null>(null);
  const { reading } = useReading();
  const done = readingStore.doneFor(surah);
  const [readMode, setReadMode] = useState<Record<number, boolean>>({});
  const [page, setPage] = useState(Math.max(0, Math.floor(((from ?? 1) - 1) / PAGE)));
  const [dl, setDl] = useState<{ state: 'none' | 'busy' | 'done' | 'error'; done: number; total: number }>({ state: 'none', done: 0, total: 0 });

  const [state, retry] = useAsync(async () => {
    const [ayahs, ch, lessons] = await Promise.all([
      api.GET('/api/v1/surahs/{n}/ayahs', { params: { path: { n: surah } } }), api.GET('/api/v1/surahs'), api.GET('/api/v1/lessons'),
    ]);
    if (!ayahs.data) throw new Error('ayahs');
    const lessonId = ((lessons.data ?? []) as { id: number; ayahRange?: string | null }[]).find((l) => l.ayahRange?.startsWith(`${surah}:`))?.id ?? null;
    return { ayahs: ayahs.data, chapter: ch.data?.find((x) => x.id === surah), lessonId };
  }, [surah]);

  // meaning of every ayah in the reader's language (optional: Arabic still shows without it)
  const [tr] = useAsync(async () => (await api.GET('/api/v1/surahs/{n}/translations', { params: { path: { n: surah }, query: { lang } } })).data ?? null, [surah, lang]);
  const trMap = useMemo(() => new Map(tr.status === 'ready' && tr.data ? tr.data.ayahs.map((a) => [a.ayah, a.text]) : []), [tr]);

  useEffect(() => {
    void listDownloads().then((l) => l.some((d) => d.surah === surah) && setDl({ state: 'done', done: 0, total: 0 }));
  }, [surah]);

  const markDone = (ayah: number, lessonId: number | null) => {
    readingStore.markRead(surah, ayah);
    if (lessonId !== null) void authed(() => api.PUT('/api/v1/progress/{lessonId}', { params: { path: { lessonId } }, body: { completedItems: readingStore.doneFor(surah).length } })).catch(() => undefined);
  };

  const startDownload = async () => {
    setDl({ state: 'busy', done: 0, total: 0 });
    try { await downloadSurah(surah, (d, n) => setDl({ state: 'busy', done: d, total: n })); setDl({ state: 'done', done: 0, total: 0 }); }
    catch { setDl({ state: 'error', done: 0, total: 0 }); }
  };

  const langLabel = lang === 'ar' ? t('tafsir') : LANGS.find((l) => l.code === lang)!.label;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 90 }}>
      <Async state={state} retry={retry}>
        {({ ayahs, chapter, lessonId }) => {
          const pages = Math.ceil(ayahs.length / PAGE);
          const slice = ayahs.slice(page * PAGE, page * PAGE + PAGE);
          const go = (p: number) => { setPage(p); wi.clear(); readingStore.setLast(surah, p * PAGE + 1); };
          const pager = pages > 1 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Btn label={`← ${t('prev')}`} disabled={page === 0} onPress={() => go(page - 1)} />
              <T style={{ color: c.muted, fontSize: 13 }}>{page + 1} / {pages}</T>
              <Btn label={`${t('next')} →`} disabled={page >= pages - 1} onPress={() => go(page + 1)} />
            </View>
          );
          return (
            <>
              <T bold style={{ fontSize: 22 }}>{lang === 'ar' && chapter ? chapter.nameArabic : `${t('surah')} ${chapter ? surahName(lang, chapter) : surah}`}</T>
              {lang !== 'ar' && <Text style={{ fontFamily: 'AmiriQuran_400Regular', fontSize: 30, color: c.text }}>{chapter?.nameArabic}</Text>}
              <T style={{ color: c.muted, fontSize: 13 }}>{t('progress')}: {done.length} / {ayahs.length}</T>
              <Btn kind="ghost" label={`📜 ${t('surahTafsir')}`} onPress={() => open({ name: 'tafsir', surah })} />
              <T style={{ color: c.muted, fontSize: 13 }}>{t('tapHint')}</T>
              <T style={{ color: c.muted, fontSize: 13 }}>{t('disclaimer')}</T>

              <Card>
                <T bold>{t('offlineAudio')}</T>
                <T style={{ fontSize: 13, color: c.muted }}>{t('downloadNote')}</T>
                {dl.state === 'busy' && <T accessibilityLiveRegion="polite">{t('downloading')} {dl.done}/{dl.total}</T>}
                {dl.state === 'error' && <T>{t('errorBody')}</T>}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                  {dl.state !== 'done' && <Btn label={`⬇ ${t('download')}`} disabled={dl.state === 'busy'} onPress={() => void startDownload()} />}
                  {dl.state === 'done' && <><T>✓ {t('downloaded')}</T><Btn kind="ghost" label={t('deleteDownload')} onPress={() => { void deleteSurah(surah).then(() => setDl({ state: 'none', done: 0, total: 0 })); }} /></>}
                </View>
              </Card>

              {pager}
              {slice.map((a) => {
                const words = a.words.filter((w) => w.charType === 'word');
                const chipWord = wi.selected && wi.selected.key.startsWith(a.key + ':') ? wi.selected : null;
                const rm = !!readMode[a.ayah];
                const text = trMap.get(a.ayah);
                return (
                  <Card key={a.key}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}><T bold style={{ color: c.accent, fontSize: 14 }}>{done.includes(a.ayah) ? '✓' : a.ayah}</T></View>
                      <View style={{ flexDirection: 'row' }}>
                        <Btn kind={isBookmarked(reading, surah, a.ayah) ? 'primary' : 'ghost'} label="📌" a11y={isBookmarked(reading, surah, a.ayah) ? t('unpin') : t('pin')} onPress={() => readingStore.togglePin(surah, a.ayah)} />
                        <Btn label={`📖 ${t('details')}`} onPress={() => { readingStore.setLast(surah, a.ayah); setDetails(a.ayah); }} />
                      </View>
                    </View>

                    <View style={{ backgroundColor: c.surface2, borderRadius: 12, paddingTop: 22, paddingBottom: 8, paddingHorizontal: 8 }}>
                      <Text style={{ position: 'absolute', top: 5, right: 10, fontSize: 11, fontWeight: '700', color: c.accent }}>العربية</Text>
                      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                        {words.map((w) => (
                          <WordView key={w.key} word={w} selected={wi.selected?.key === w.key} activeSyllable={wi.bd?.key === w.key ? wi.bd.index : -1}
                            hidePron={rm} showGloss={wordMeanings && !rm} onSingle={(x) => { readingStore.setLast(surah, a.ayah); wi.tap(x); }} onDouble={(x) => { readingStore.setLast(surah, a.ayah); void wi.breakDown(x); }} />
                        ))}
                      </View>
                    </View>

                    {!!text && (
                      <View style={{ marginTop: 8, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingTop: 20, paddingBottom: 10, paddingHorizontal: 12 }}>
                        <Text style={{ position: 'absolute', top: 4, [dirOf(lang) === 'rtl' ? 'right' : 'left']: 10, fontSize: 11, fontWeight: '700', color: c.accent }}>{langLabel}</Text>
                        <Text style={{ fontFamily: 'NotoSansBengali_400Regular', fontSize: 16, lineHeight: 28, color: c.text, writingDirection: dirOf(lang), textAlign: dirOf(lang) === 'rtl' ? 'right' : 'left' }}>{text}</Text>
                      </View>
                    )}

                    {chipWord && <Chip word={chipWord} notice={wi.notice} wi={wi} />}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                      <Btn kind="ghost" label={`👁 ${t('readMode')}`} onPress={() => setReadMode((o) => ({ ...o, [a.ayah]: !o[a.ayah] }))} />
                      {rm && <Btn label={done.includes(a.ayah) ? t('done') : t('iReadIt')} disabled={done.includes(a.ayah)} onPress={() => markDone(a.ayah, lessonId)} />}
                    </View>
                  </Card>
                );
              })}
              {pager}
            </>
          );
        }}
      </Async>
      {details !== null && <DetailsModal surah={surah} ayah={details} onClose={() => setDetails(null)} />}
    </ScrollView>
  );
}
