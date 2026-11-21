import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View, type TextStyle } from 'react-native';
import { useSettings } from '../settings';
import type { AsyncState } from '../useAsync';

export function T({ children, style, bold, lang, accessibilityLiveRegion, numberOfLines }: { children: ReactNode; style?: TextStyle; bold?: boolean; lang?: string; accessibilityLiveRegion?: 'none' | 'polite' | 'assertive'; numberOfLines?: number }) {
  const { colors, fontScale } = useSettings();
  return <Text accessibilityLanguage={lang} accessibilityLiveRegion={accessibilityLiveRegion} numberOfLines={numberOfLines} style={[{ fontFamily: bold ? 'NotoSansBengali_700Bold' : 'NotoSansBengali_400Regular', color: colors.text, fontSize: 16 * fontScale, lineHeight: 16 * fontScale * 1.6 }, style]}>{children}</Text>;
}

export function Btn({ label, onPress, disabled, kind = 'normal', a11y }: { label: string; onPress: () => void; disabled?: boolean; kind?: 'normal' | 'primary' | 'ghost'; a11y?: string }) {
  const { colors: c, fontScale } = useSettings();
  const bg = kind === 'primary' ? c.accent : c.surface;
  const fg = kind === 'primary' ? c.onAccent : kind === 'ghost' ? c.text : c.accent;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y ?? label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
      style={{ minHeight: 44, minWidth: 44, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', borderRadius: 22, borderWidth: 1, borderColor: kind === 'ghost' ? c.line : c.accent, backgroundColor: bg, opacity: disabled ? 0.55 : 1, marginRight: 8, marginVertical: 4 }}>
      <Text style={{ color: fg, fontFamily: 'NotoSansBengali_400Regular', fontSize: 15 * fontScale }}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children }: { children: ReactNode }) {
  const { colors: c } = useSettings();
  return <View style={{ backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, borderRadius: 20, padding: 12, marginVertical: 6 }}>{children}</View>;
}

export function Disclaimer() {
  const { t, colors: c } = useSettings();
  return <View accessibilityRole="summary" style={{ backgroundColor: c.warn, borderRadius: 8, padding: 10, marginVertical: 8 }}><T style={{ fontSize: 14 }}>ℹ {t('disclaimer')}</T></View>;
}

export function Async<D>({ state, retry, children }: { state: AsyncState<D>; retry: () => void; children: (d: D) => ReactNode }) {
  const { t, colors: c } = useSettings();
  if (state.status === 'loading') return <View style={{ padding: 24 }} accessibilityLiveRegion="polite"><ActivityIndicator color={c.accent} /><T style={{ textAlign: 'center', color: c.muted }}>{t('loading')}</T></View>;
  if (state.status === 'error')
    return <View style={{ padding: 24, alignItems: 'center' }} accessibilityRole="alert"><T bold>{t('errorTitle')}</T><T style={{ textAlign: 'center', color: c.muted }}>{t('errorBody')}</T><Btn label={t('retry')} onPress={retry} /></View>;
  return <>{children(state.data)}</>;
}
