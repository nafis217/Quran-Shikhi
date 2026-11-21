/** Our own lesson list (no Quran text). Same order and ids as the original C# seeder. */
export interface LessonSeed { order: number; title: string; titleEn: string; type: 'surah' | 'familiar' | 'frequent'; ayahRange: string | null }
export interface FamiliarSeed { arabicMatch: string; labelBn: string; labelEn: string }

export const FAMILIAR: FamiliarSeed[] = [
  { arabicMatch: 'الله', labelBn: 'আল্লাহ', labelEn: 'Allah' },
  { arabicMatch: 'رحمن', labelBn: 'রাহমান', labelEn: 'Rahman' },
  { arabicMatch: 'صلاة|صلوة', labelBn: 'সালাত', labelEn: 'Salat' },
  { arabicMatch: 'كتاب|كتب', labelBn: 'কিতাব', labelEn: 'Kitab' },
  { arabicMatch: 'نور', labelBn: 'নূর', labelEn: 'Nur' },
  { arabicMatch: 'دنيا', labelBn: 'দুনিয়া', labelEn: 'Dunya' },
  { arabicMatch: 'اخرة|ءاخرة|اخره|ءاخره', labelBn: 'আখিরাত', labelEn: 'Akhirat' },
];

export function lessonSeeds(): LessonSeed[] {
  const list: LessonSeed[] = [
    { order: 1, title: 'সূরা আল-ফাতিহা', titleEn: 'Surah Al-Fatiha', type: 'surah', ayahRange: '1:1-1:7' },
    { order: 2, title: 'পরিচিত শব্দ আগে', titleEn: 'Familiar words first', type: 'familiar', ayahRange: null },
    { order: 3, title: 'সবচেয়ে বেশি ব্যবহৃত ~৩০০ শব্দ', titleEn: 'Most frequent ~300 words', type: 'frequent', ayahRange: null },
  ];
  let order = 4;
  for (let s = 114; s >= 78; s--) list.push({ order: order++, title: `সূরা ${s}`, titleEn: `Surah ${s}`, type: 'surah', ayahRange: `${s}:1` }); // short surahs first
  return list;
}

/** Context cards are all Draft: NEVER shown until a qualified scholar reviews them. */
export const DRAFT_CARDS = [
  { ayahKey: '111:1', ayahEndKey: '111:5', source: 'Sahih al-Bukhari (narration summary) — NEEDS SCHOLAR REVIEW', textBn: '[খসড়া — আলিমের যাচাই প্রয়োজন] সাফা পাহাড়ে রাসূল ﷺ-এর আহ্বানের পর আবু লাহাবের প্রতিক্রিয়া সংক্রান্ত বর্ণনা।' },
  { ayahKey: '93:1', ayahEndKey: '93:3', source: 'Sahih al-Bukhari (narration summary) — NEEDS SCHOLAR REVIEW', textBn: '[খসড়া — আলিমের যাচাই প্রয়োজন] ওহী আসা কিছুদিন বিরতি থাকার প্রেক্ষাপট সংক্রান্ত বর্ণনা।' },
  { ayahKey: '108:1', ayahEndKey: '108:3', source: 'Needs source and scholar review', textBn: '[খসড়া — উৎস ও আলিমের যাচাই প্রয়োজন]' },
];
