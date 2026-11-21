import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Word } from '@quran-shikkha/api-client';
import { createTapDetector, pickByLang, pronScript, pronText, sylLatin } from '@quran-shikkha/learning-core';
import { pron } from '../pron';
import { useSettings } from '../settings';

interface Props {
  word: Word;
  selected: boolean;
  activeSyllable: number;
  hidePron?: boolean;
  showGloss?: boolean;
  onSingle: (w: Word) => void;
  onDouble: (w: Word) => void;
}

/** Tap = Shuni, double-tap = Bhangi. The label gives screen readers the word, its Bangla reading and meaning. */
export function WordView({ word, selected, activeSyllable, hidePron, showGloss, onSingle, onDouble }: Props) {
  const { colors: c, fontScale, showPron, lang, t } = useSettings();
  const p = useMemo(() => pron(word.arabicText), [word.arabicText]);
  const tap = useMemo(() => createTapDetector(() => onSingle(word), () => onDouble(word)), [word, onSingle, onDouble]);
  const meaning = pickByLang(lang, word.meaningBn, word.meaningEn);
  const tagColor = { foreign: c.foreign, throat: c.throat, heavy: c.heavy } as const;

  return (
    <Pressable
      onPress={tap}
      accessibilityRole="button"
      accessibilityLabel={`${word.arabicText}. ${pronText(p, lang)}.${meaning ? ' ' + meaning : ''}`}
      accessibilityHint={t('wordHint')}
      accessibilityState={{ selected }}
      style={{ minWidth: 44, minHeight: 44, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 2, borderColor: selected ? c.accent : 'transparent', alignItems: 'center' }}
    >
      <Text style={{ fontFamily: 'AmiriQuran_400Regular', fontSize: 30 * fontScale, color: c.text, lineHeight: 30 * fontScale * 2 }} allowFontScaling>{word.arabicText}</Text>
      {showPron && !hidePron && (
        <View style={{ flexDirection: 'row' }} importantForAccessibility="no-hide-descendants">
          {p.syllables.map((s, i) => (
            <View key={i} style={{ paddingHorizontal: 3, marginHorizontal: 1, borderRadius: 4, backgroundColor: i === activeSyllable ? c.hl : 'transparent', borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: c.line }}>
              <Text style={{ fontFamily: 'NotoSansBengali_400Regular', fontSize: 14 * fontScale }}>
                {(pronScript(lang) === 'bn' ? s.segments : [{ text: sylLatin(s.latin), tag: undefined }]).map((g, j) => (
                  <Text key={j} style={{ color: g.tag ? tagColor[g.tag] : i === activeSyllable ? c.onHl : c.muted, fontFamily: g.tag ? 'NotoSansBengali_700Bold' : 'NotoSansBengali_400Regular' }}>{g.text}</Text>
                ))}
              </Text>
            </View>
          ))}
        </View>
      )}
      {showGloss && !!meaning && <Text style={{ fontFamily: 'NotoSansBengali_400Regular', fontSize: 12 * fontScale, color: c.muted, textAlign: 'center', maxWidth: 110 * fontScale, marginTop: 2 }}>{meaning}</Text>}
    </Pressable>
  );
}
