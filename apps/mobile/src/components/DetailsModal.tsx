import { Modal, Pressable, ScrollView, View } from 'react-native';
import { LANGS, htmlToText, pickByLang, type Lang } from '@quran-shikkha/learning-core';
import { useState } from 'react';
import { api } from '../api';
import { play, stopAudio } from '../audio';
import { useAsync } from '../useAsync';
import { useSettings } from '../settings';
import { Async, Btn, T } from './Ui';

/** Long texts start collapsed. */
function Long({ text }: { text: string }) {
  const { t } = useSettings();
  const [open, setOpen] = useState(false);
  return (
    <View>
      <T numberOfLines={open || text.length < 700 ? undefined : 12}>{text}</T>
      {text.length >= 700 && <Btn kind="ghost" label={open ? t('readLess') : t('readMore')} onPress={() => setOpen(!open)} />}
    </View>
  );
}

function Report({ target, id }: { target: 'tafsir' | 'translation' | 'context'; id: string }) {
  const { t } = useSettings();
  const [s, setS] = useState<'idle' | 'sent' | 'err'>('idle');
  if (s === 'sent') return <T style={{ fontSize: 14 }}>{t('reportSent')}</T>;
  return <Btn kind="ghost" label={`⚑ ${t('report')}`} onPress={() => { void api.POST('/api/v1/reports', { body: { targetType: target, targetId: id, note: '' } }).then((r) => setS(r.response.ok ? 'sent' : 'err'), () => setS('err')); }} />;
}

/** "Govire Jai": bottom sheet with translation, tafsir, context card (Reviewed only, enforced server-side) and recitation. */
export function DetailsModal({ surah, ayah, onClose }: { surah: number; ayah: number; onClose: () => void }) {
  const { t, lang, colors: c } = useSettings();
  const [audioMsg, setAudioMsg] = useState('');
  const [tLang, setTLang] = useState<Lang>(lang);
  const [state, retry] = useAsync(async () => {
    const r = await api.GET('/api/v1/ayahs/{surah}:{ayah}/details', { params: { path: { surah, ayah } } });
    if (!r.data) throw new Error('details');
    return r.data;
  }, [surah, ayah]);
  const close = () => { void stopAudio(); onClose(); };

  return (
    <Modal transparent animationType="slide" onRequestClose={close} accessibilityViewIsModal>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.45)' }} onPress={close} accessibilityLabel={t('close')} />
      <View style={{ backgroundColor: c.surface, maxHeight: '82%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T bold>{t('surah')} {surah} · {t('ayah')} {ayah}</T>
          <Btn kind="ghost" label="✕" a11y={t('close')} onPress={close} />
        </View>
        <ScrollView>
          <Async state={state} retry={retry}>
            {(d) => {
              const meaning = pickByLang(lang, d.translationBn, d.translationEn);
              const tafsir = tLang === 'bn' ? d.tafsirBn : tLang === 'en' ? d.tafsirEn : d.tafsirAr;
              return (
                <View>
                  <T bold>{t('translation')}</T>
                  {meaning ? <><T>{meaning.text}</T><T style={{ color: c.muted, fontSize: 13 }}>{t('source')}: {meaning.source}{meaning.version ? ` · ${t('version')} ${meaning.version}` : ''}</T></> : <T style={{ color: c.muted }}>{t('empty')}</T>}
                  <Report target="translation" id={`${surah}:${ayah}`} />

                  <T bold style={{ marginTop: 12 }}>{t('tafsir')}</T>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {LANGS.map((l) => <Btn key={l.code} kind={tLang === l.code ? 'primary' : 'normal'} label={l.label} onPress={() => setTLang(l.code)} />)}
                  </View>
                  {tafsir ? (
                    <>
                      {tafsir.hasPlaceholder && <View style={{ backgroundColor: c.warn, padding: 8, borderRadius: 8 }}><T style={{ fontSize: 14 }}>{t('placeholderWarn')}</T></View>}
                      <Long text={htmlToText(tafsir.text)} />
                      <T style={{ color: c.muted, fontSize: 13 }}>{t('source')}: {tafsir.name}{tafsir.attribution ? ` · ${tafsir.attribution}` : ''}</T>
                      <Report target="tafsir" id={`${surah}:${ayah}#${tLang}`} />
                    </>
                  ) : <T style={{ color: c.muted }}>{t('noTafsirLang')}</T>}

                  <T bold style={{ marginTop: 12 }}>{t('revelation')}</T>
                  {d.revelation ? <><Long text={htmlToText(d.revelation.text)} /><T style={{ color: c.muted, fontSize: 13 }}>{t('source')}: {d.revelation.name}. {t('revelationNote')}</T></> : <T style={{ color: c.muted }}>{t('noRevelation')}</T>}
                  {d.context && (
                    <View style={{ backgroundColor: c.warn, borderRadius: 10, padding: 10, marginTop: 12 }}>
                      <T bold>{t('context')}</T><T>{d.context.textBn}</T>
                      <T style={{ color: c.muted, fontSize: 13 }}>{t('source')}: {d.context.source}</T>
                      <Report target="context" id={`${surah}:${ayah}`} />
                    </View>
                  )}

                  <T bold style={{ marginTop: 12 }}>{t('recitation')}</T>
                  {d.audioUrl ? (
                    <>
                      <Btn label={`▶ ${t('playAyah')}`} onPress={() => { setAudioMsg(''); void play(surah, d.audioUrl).then((r) => !r.ok && setAudioMsg(t('noAudio'))); }} />
                      {d.reciter && <T style={{ color: c.muted, fontSize: 13 }}>{t('reciter')}: {d.reciter}</T>}
                    </>
                  ) : <T style={{ color: c.muted }}>{t('noAudio')}</T>}
                  {!!audioMsg && <T accessibilityLiveRegion="polite" style={{ fontSize: 14 }}>{audioMsg}</T>}
                </View>
              );
            }}
          </Async>
        </ScrollView>
      </View>
    </Modal>
  );
}
