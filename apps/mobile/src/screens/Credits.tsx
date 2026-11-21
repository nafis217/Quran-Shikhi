import { useEffect, useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { api } from '../api';
import { deleteSurah, listDownloads } from '../offline';
import { useAsync } from '../useAsync';
import { useSettings } from '../settings';
import { Async, Btn, Card, T } from '../components/Ui';

export default function Credits() {
  const { t, colors: c } = useSettings();
  const [dl, setDl] = useState<{ surah: number; files: number; reciter: string | null }[]>([]);
  useEffect(() => { void listDownloads().then(setDl); }, []);
  const [state, retry] = useAsync(async () => {
    const r = await api.GET('/api/v1/credits');
    if (!r.data) throw new Error('credits');
    return r.data;
  }, []);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
      <T bold style={{ fontSize: 22 }}>{t('credits')}</T>
      <View style={{ backgroundColor: c.warn, borderRadius: 8, padding: 10, marginVertical: 8 }}><T style={{ fontSize: 14 }}>ℹ {t('disclaimer')}</T></View>
      <Async state={state} retry={retry}>
        {(d) => (
          <View>
            {d.sources.map((s) => (
              <Card key={s.name}><T bold>{s.name}</T><T>{s.what}</T><Btn kind="ghost" label={s.url} onPress={() => void Linking.openURL(s.url)} /></Card>
            ))}
            <Card><T bold>{t('reciter')}</T><T>{d.reciter ?? '—'}</T></Card>
            <Card><T bold>{t('fonts')}</T><T>Noto Sans Bengali (SIL OFL 1.1), Amiri Quran (SIL OFL 1.1)</T></Card>
          </View>
        )}
      </Async>
      <T bold style={{ marginTop: 12 }}>{t('offlineAudio')}</T>
      <T style={{ color: c.muted, fontSize: 13 }}>{t('downloadNote')}</T>
      {dl.length === 0 && <T style={{ color: c.muted }}>{t('empty')}</T>}
      {dl.map((d) => (
        <Card key={d.surah}>
          <T>{t('surah')} {d.surah} · {d.files} {t('files')}{d.reciter ? ` · ${t('reciter')}: ${d.reciter}` : ''}</T>
          <Btn kind="ghost" label={t('deleteDownload')} onPress={() => { void deleteSurah(d.surah).then(() => listDownloads().then(setDl)); }} />
        </Card>
      ))}
    </ScrollView>
  );
}
