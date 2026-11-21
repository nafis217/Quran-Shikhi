import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { LANGS, dirOf, htmlToText, surahName, type Lang } from '@quran-shikkha/learning-core';
import { api } from '../api';
import { useAsync } from '../useAsync';
import { useSettings } from '../settings';
import { Async, Btn, Card, T } from '../components/Ui';

const PAGE = 5;

function Long({ text }: { text: string }) {
  const { t } = useSettings();
  const [open, setOpen] = useState(false);
  const plain = htmlToText(text);
  return (
    <View>
      <T numberOfLines={open || plain.length < 700 ? undefined : 12}>{plain}</T>
      {plain.length >= 700 && <Btn kind="ghost" label={open ? t('readLess') : t('readMore')} onPress={() => setOpen(!open)} />}
    </View>
  );
}

/** Every ayah of a surah with its meaning and tafsir, in the language you choose. */
export default function TafsirScreen({ surah }: { surah: number }) {
  const { t, lang, colors: c } = useSettings();
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
    return { ayahs: ayahs.data, chapter: chapters.data?.find((x) => x.id === surah), tafsir: tafsir.data ?? null, trans: trans.data ?? null };
  }, [surah, tLang]);
  const taf = useMemo(() => new Map(state.status === 'ready' && state.data.tafsir ? state.data.tafsir.ayahs.map((a) => [a.ayah, a.text]) : []), [state]);
  const tra = useMemo(() => new Map(state.status === 'ready' && state.data.trans ? state.data.trans.ayahs.map((a) => [a.ayah, a.text]) : []), [state]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 90 }}>
      <Async state={state} retry={retry}>
        {({ ayahs, chapter, tafsir }) => {
          const pages = Math.ceil(ayahs.length / PAGE);
          return (
            <>
              <T bold style={{ fontSize: 22 }}>{t('tafsir')} · {lang === 'ar' && chapter ? chapter.nameArabic : chapter ? surahName(lang, chapter) : surah}</T>
              <T style={{ color: c.muted, fontSize: 13 }}>{t('tafsirLang')}</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {LANGS.map((l) => <Btn key={l.code} kind={tLang === l.code ? 'primary' : 'normal'} label={l.label} onPress={() => { setTLang(l.code); setPage(0); }} />)}
              </View>
              {tafsir ? <T style={{ color: c.muted, fontSize: 13 }}>{t('source')}: {tafsir.source}{tafsir.attribution ? ` · ${tafsir.attribution}` : ''}</T> : <T style={{ color: c.muted }}>{t('noTafsirLang')}</T>}
              {ayahs.slice(page * PAGE, page * PAGE + PAGE).map((a) => (
                <Card key={a.key}>
                  <T bold style={{ color: c.accent }}>{a.ayah}</T>
                  <View style={{ backgroundColor: c.surface2, borderRadius: 12, padding: 10 }}>
                    <Text style={{ fontFamily: 'AmiriQuran_400Regular', fontSize: 28, lineHeight: 60, color: c.text, writingDirection: 'rtl', textAlign: 'right' }}>{a.words.filter((w) => w.charType === 'word').map((w) => w.arabicText).join(' ')}</Text>
                  </View>
                  {!!tra.get(a.ayah) && <T style={{ marginTop: 8, writingDirection: dirOf(tLang), textAlign: dirOf(tLang) === 'rtl' ? 'right' : 'left' }}>{tra.get(a.ayah)}</T>}
                  <T bold style={{ marginTop: 8 }}>{t('tafsir')}</T>
                  {taf.get(a.ayah) ? <Long text={taf.get(a.ayah)!} /> : <T style={{ color: c.muted, fontSize: 13 }}>{tafsir ? t('tafsirTogether') : ''}</T>}
                </Card>
              ))}
              {pages > 1 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <Btn label={`← ${t('prev')}`} disabled={page === 0} onPress={() => setPage(page - 1)} />
                  <T style={{ color: c.muted, fontSize: 13 }}>{page + 1} / {pages}</T>
                  <Btn label={`${t('next')} →`} disabled={page >= pages - 1} onPress={() => setPage(page + 1)} />
                </View>
              )}
            </>
          );
        }}
      </Async>
    </ScrollView>
  );
}
