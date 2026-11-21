import { useMemo, useRef } from 'react';
import type { Word } from '@quran-shikkha/api-client';
import { createTapDetector, pickByLang, pronScript, pronText, sylLatin } from '@quran-shikkha/learning-core';
import { pron } from '../lib/pron';
import { useSettings } from '../settings';
import type { Breakdown } from '../lib/useWordInteraction';

interface Props {
  word: Word;
  selected: boolean;
  breakdown: Breakdown | null;
  onSingle: (w: Word) => void;
  onDouble: (w: Word) => void;
  onHover?: (w: Word) => void;
  showPron?: boolean;
  showMeaningLine?: boolean;
}

const TAG_LABEL = { foreign: 'বিশেষ ধ্বনি', throat: 'কণ্ঠ থেকে', heavy: 'মোটা ধ্বনি' } as const;

export function WordButton({ word, selected, breakdown, onSingle, onDouble, onHover, showPron, showMeaningLine }: Props) {
  const s = useSettings();
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const p = useMemo(() => pron(word.arabicText), [word.arabicText]);
  const tap = useMemo(() => createTapDetector(() => onSingle(word), () => onDouble(word)), [word, onSingle, onDouble]);
  const activeIdx = breakdown && breakdown.key === word.key ? breakdown.index : -1;
  const pronOn = showPron ?? s.showPron;
  const meaning = pickByLang(s.lang, word.meaningBn, word.meaningEn);

  return (
    <button
      type="button"
      className="word"
      data-selected={selected || undefined}
      data-breaking={activeIdx >= 0 || undefined}
      lang="ar"
      onClick={tap}
      onPointerEnter={(e) => {
        if (e.pointerType !== 'mouse' || !onHover || !s.hoverAudio) return;
        hoverTimer.current = setTimeout(() => onHover(word), 250); // short delay: no sound when just passing over
      }}
      onPointerLeave={() => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }}
      onKeyDown={(e) => { if (e.key === 'b' || e.key === 'B') { e.preventDefault(); onDouble(word); } }}
      aria-pressed={selected}
      aria-label={`${word.arabicText}. ${pronText(p, s.lang)}.${meaning ? ' ' + meaning + '.' : ''}`}
      title={`${pronText(p, s.lang)}${meaning ? ' — ' + meaning : ''}`}
    >
      <span className="ar" dir="rtl">{word.arabicText}</span>
      {pronOn && (
        <span className="bn-pron" lang={pronScript(s.lang) === 'bn' ? 'bn' : 'en'} aria-hidden="true">
          {p.syllables.map((syl, i) => (
            <span key={i} className="syl" data-active={i === activeIdx || undefined}>
              {pronScript(s.lang) === 'bn'
                ? syl.segments.map((seg, j) => (
                    <span key={j} className={seg.tag ? `mark mark-${seg.tag}` : undefined} title={seg.tag ? TAG_LABEL[seg.tag] : undefined}>{seg.text}</span>
                  ))
                : sylLatin(syl.latin)}
            </span>
          ))}
        </span>
      )}
      {showMeaningLine && meaning && <span className="gloss" lang={s.lang}>{meaning}</span>}
    </button>
  );
}
