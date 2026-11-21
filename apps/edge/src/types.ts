/** JSON shapes served by the API. They match the original C# backend exactly (camelCase, string enums). */
export interface WordDto { key: string; position: number; arabicText: string; audioPath: string | null; meaningBn: string | null; meaningEn: string | null; translitLatin: string | null; charType: string }
export interface AyahDto { key: string; surah: number; ayah: number; words: WordDto[] }
export interface TextSource { text: string; source: string; version: string | null; attribution: string | null }
export interface TafsirDto { resourceId: number; name: string; attribution: string | null; text: string; hasPlaceholder: boolean }
export interface ContextCardDto { source: string; textBn: string; textEn: string | null }
export interface AyahDetailsDto {
  key: string; translationBn: TextSource | null; translationEn: TextSource | null; tafsirBn: TafsirDto | null; context: ContextCardDto | null;
  audioUrl: string | null; reciter: string | null; arabicText: string | null; tafsirEn: TafsirDto | null; tafsirAr: TafsirDto | null; revelation: TafsirDto | null;
}
export interface AyahText { ayah: number; text: string }
export interface SurahTexts { language: string; source: string; version: string | null; attribution: string | null; ayahs: AyahText[] }
export interface ChapterDto { id: number; nameSimple: string; nameArabic: string; translatedName: string | null; versesCount: number }
export interface FrequentWordDto { rank: number; arabicText: string; count: number; cumulativeCoveragePercent: number; exampleKey: string; meaningBn: string | null; audioPath: string | null; meaningEn: string | null }
export interface FrequencyTrackDto { totalWordTokens: number; distinctWords: number; words: FrequentWordDto[]; coveragePercent: number; scope: string }
