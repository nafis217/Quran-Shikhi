import { pronText, type Lang, type VocabWord } from '@quran-shikkha/learning-core';
import { pron } from './pron';

export const vocabPron = (w: VocabWord, lang: Lang): string => w.ar.split(/\s+/).filter(Boolean).map((t) => pronText(pron(t), lang)).join(' ');
