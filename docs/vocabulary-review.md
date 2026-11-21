# Daily-Arabic vocabulary: review checklist

The 212 everyday words and phrases in `packages/learning-core/src/vocab/vocab.ts` were **written by hand by an AI assistant and have
not been reviewed by a person**. Treat them as a DRAFT.

## Please have a native Arabic speaker check
- The spelling and vowel marks (harakat) of every word. Words are given in their dictionary form without case endings.
- Phrases (`السَّلَامُ عَلَيْكُمْ`, `كَيْفَ حَالُكَ؟` ...) use the masculine "you"; a feminine form is not offered yet.
- Regional choices: e.g. `بَطَاطِس` (potato), `طَمَاطِم` (tomatoes), `شُورْبَة` (soup) vary by country.
- Colours are masculine singular forms.

## Please have a Bangla speaker check
- The Bangla meaning of every word (some have two common choices, written "A / B").

## Pictures
- Pictures are Unicode emoji, drawn by each phone or browser's own emoji font (no image files, no licences). Looks differ per device.
- Rule enforced by a test: no two picture words share an emoji. Phrases and days have no picture and are skipped by picture games.
- `تَمْر` (dates) uses the palm tree emoji because there is no emoji for the fruit.

## Spoken voice
- Uses the voice installed on the device (browser Web Speech API, phone text-to-speech). It is a computer voice, not a recording. If the device has no Arabic voice the app says so instead of speaking nonsense.
- It is never used for the Quran. Quran audio always comes from reciters.

## How to change the list
Edit the table in `vocab.ts` (or `docs` PR on GitHub). Tests check: unique ids, vowel marks present, distinct pictures, both meanings present, and that the pronunciation engine can handle every word. A word's `id` is also its flashcard key (`v:<id>`), so do not rename ids that learners may already have saved.
