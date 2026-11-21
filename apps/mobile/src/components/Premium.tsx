import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useSettings } from '../settings';
import { T } from './Ui';

/** Progress ring (value 0–1) with children centred inside. */
export function Ring({ value, size = 88, stroke = 8, color, children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const { colors: c } = useSettings();
  const r = (size - stroke) / 2, len = 2 * Math.PI * r, v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color ? `${color}33` : c.line} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color ?? c.accent} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${len * v} ${len}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      {children}
    </View>
  );
}

/** Gradient card with a faint eight-point-star pattern. */
export function Hero({ children }: { children: ReactNode }) {
  const { colors: c } = useSettings();
  const star = 'M20 0 L25 15 L40 20 L25 25 L20 40 L15 25 L0 20 L15 15 Z';
  return (
    <View style={{ borderRadius: 24, overflow: 'hidden', marginBottom: 12, padding: 18, backgroundColor: c.accent }}>
      <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="hg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c.accent} /><Stop offset="1" stopColor={c.hl} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#hg)" />
      </Svg>
      <Svg width={120} height={120} style={{ position: 'absolute', right: -20, top: -20, opacity: 0.15 }} viewBox="0 0 40 40"><Path d={star} fill={c.onAccent} /></Svg>
      <Svg width={70} height={70} style={{ position: 'absolute', right: 70, bottom: -18, opacity: 0.1 }} viewBox="0 0 40 40"><Path d={star} fill={c.onAccent} /></Svg>
      {children}
    </View>
  );
}

/** Surah number in an eight-point-star badge. */
export function StarBadge({ n, size = 40 }: { n: number; size?: number }) {
  const { colors: c } = useSettings();
  const star = 'M20 0 L25 15 L40 20 L25 25 L20 40 L15 25 L0 20 L15 15 Z';
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 40 40" style={{ position: 'absolute' }}><Path d={star} fill={c.surface2} stroke={c.line} strokeWidth={1} /></Svg>
      <T bold style={{ color: c.accent, fontSize: 12 }}>{n}</T>
    </View>
  );
}
