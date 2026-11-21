import { pronText, type Lang, type VocabWord } from '@quran-shikkha/learning-core';
import { pron } from './pron';

/** Pronunciation guide for a daily word or phrase (one guide per Arabic word), in the script that suits the reader's language. */
export const vocabPron = (w: VocabWord, lang: Lang): string => w.ar.split(/\s+/).filter(Boolean).map((t) => pronText(pron(t), lang)).join(' ');
