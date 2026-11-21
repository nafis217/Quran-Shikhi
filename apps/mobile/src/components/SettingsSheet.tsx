import { useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, View } from 'react-native';
import { LANGS } from '@quran-shikkha/learning-core';
import { useSettings } from '../settings';
import { Btn, T } from './Ui';

/** All preferences in one sheet, so the top bar stays clean. */
export function SettingsSheet() {
  const { t, lang, theme, showPron, wordMeanings, fontScale, age, set, colors: c } = useSettings();
  const [open, setOpen] = useState(false);
  const row = (label: string, value: boolean, onChange: (v: boolean) => void) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48 }}>
      <T>{label}</T><Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
  return (
    <>
      <Btn kind="ghost" label="⚙" a11y={t('settings')} onPress={() => setOpen(true)} />
      <Modal transparent animationType="slide" visible={open} onRequestClose={() => setOpen(false)} accessibilityViewIsModal>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.45)' }} onPress={() => setOpen(false)} accessibilityLabel={t('close')} />
        <View style={{ backgroundColor: c.surface, maxHeight: '80%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T bold style={{ fontSize: 20 }}>{t('settings')}</T>
            <Btn kind="ghost" label="✕" a11y={t('close')} onPress={() => setOpen(false)} />
          </View>
          <ScrollView>
            <T bold style={{ color: c.muted, fontSize: 13 }}>{t('language')}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {LANGS.map((l) => <Btn key={l.code} kind={lang === l.code ? 'primary' : 'normal'} label={l.label} onPress={() => set({ lang: l.code })} />)}
            </View>
            <T bold style={{ color: c.muted, fontSize: 13 }}>{t('ageGroup')}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <Btn kind={age === 'kids' ? 'primary' : 'normal'} label={`🧒 ${t('ageKids')}`} onPress={() => set({ age: 'kids' })} />
              <Btn kind={age === 'teens' ? 'primary' : 'normal'} label={t('ageTeens')} onPress={() => set({ age: 'teens' })} />
              <Btn kind={age === 'adults' ? 'primary' : 'normal'} label={t('ageAdults')} onPress={() => set({ age: 'adults' })} />
            </View>
            <T bold style={{ color: c.muted, fontSize: 13 }}>{t('theme')}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <Btn kind={theme === 'light' ? 'primary' : 'normal'} label={`☀ ${t('themeLight')}`} onPress={() => set({ theme: 'light' })} />
              <Btn kind={theme === 'dark' ? 'primary' : 'normal'} label={`🌙 ${t('themeDark')}`} onPress={() => set({ theme: 'dark' })} />
              <Btn kind={theme === 'auto' ? 'primary' : 'normal'} label={t('themeAuto')} onPress={() => set({ theme: 'auto' })} />
            </View>
            <T bold style={{ color: c.muted, fontSize: 13 }}>{t('textSize')}</T>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Btn label="A−" a11y={t('fontSmaller')} onPress={() => set({ fontScale: Math.max(0.9, +(fontScale - 0.15).toFixed(2)) })} />
              <T>{Math.round(fontScale * 100)}%</T>
              <Btn label="A+" a11y={t('fontBigger')} onPress={() => set({ fontScale: Math.min(1.9, +(fontScale + 0.15).toFixed(2)) })} />
            </View>
            {row(t('showPron'), showPron, (v) => set({ showPron: v }))}
            {row(t('wordMeanings'), wordMeanings, (v) => set({ wordMeanings: v }))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
