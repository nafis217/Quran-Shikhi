import type { PracticeMode } from './screens/Practice';

export type Nav =
  | { name: 'home' }
  | { name: 'reader'; surah: number; from?: number }
  | { name: 'tafsir'; surah: number }
  | { name: 'frequent' }
  | { name: 'familiar'; id: number }
  | { name: 'flashcards' }
  | { name: 'credits' }
  | { name: 'practice'; mode?: PracticeMode };
