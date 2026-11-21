import { ScrollView, View } from 'react-native';
import type { Word } from '@quran-shikkha/api-client';
import { pickByLang } from '@quran-shikkha/learning-core';
import { api } from '../api';
import { useAsync } from '../useAsync';
import { useSettings } from '../settings';
import { useWordInteraction } from '../useWordInteraction';
import { WordView } from '../components/WordView';
import { Async, Card, Disclaimer, T } from '../components/Ui';

interface Item { labelBn: string; labelEn?: string | null; word?: Word | null }

export default function Familiar({ id }: { id: number }) {
  const { t, lang, colors: c } = useSettings();
  const wi = useWordInteraction(0);
  const [state, retry] = useAsync(async () => {
    const r = await api.GET('/api/v1/lessons/{id}', { params: { path: { id } } });
    if (!r.data) throw new Error('lesson');
    return r.data as unknown as { title: string; titleEn: string; items: Item[] };
  }, [id]);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
      <Async state={state} retry={retry}>
        {(d) => (
          <View>
            <T bold style={{ fontSize: 22 }}>{t('lessonFamiliar')}</T>
            <T style={{ color: c.muted }}>{t('familiarIntro')} {t('tapHint')}</T>
            <Disclaimer />
            {d.items.map((it, i) => (
              <Card key={i}>
                <T bold>{pickByLang(lang, it.labelBn, it.labelEn)}</T>
                {it.word ? (
                  <View style={{ flexDirection: 'row-reverse' }}>
                    <WordView word={it.word} selected={wi.selected?.key === it.word.key} activeSyllable={wi.bd?.key === it.word.key ? wi.bd.index : -1} onSingle={wi.tap} onDouble={(w) => void wi.breakDown(w)} />
                  </View>
                ) : <T style={{ color: c.muted }}>{t('notInScope')}</T>}
              </Card>
            ))}
          </View>
        )}
      </Async>
    </ScrollView>
  );
}
