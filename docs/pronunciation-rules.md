# Bangla-script pronunciation rules (for reviewer audit)

**Status: DRAFT. Not yet reviewed by a qualified Tajweed scholar.** The golden tests in
`packages/pronunciation-engine/test/fatiha.golden.test.ts` freeze these conventions. Any change a reviewer requests
should be made in `src/tables.ts` (consonants and vowels) or `src/engine.ts` (logic), and then the goldens updated.

UI must always show: *"Bangla spelling is only a guide; learn correct Tajweed from a qualified teacher."*
(exported as `DISCLAIMER_BN` / `DISCLAIMER_EN`).

The engine is a pure function over one word. It **never modifies the Arabic**. It returns Bangla text, Latin text,
syllables (each with colour-able segments) and notes.

## 1. Consonants
Sounds Bangla has no letter for are written with a **nukta (়)** and carry a `tag` so the UI can also colour them.

| Arabic | Bangla | Latin | Tag |
|---|---|---|---|
| ب | ব | b | |
| ت | ত | t | |
| ث | ছ় | th | foreign |
| ج | জ | j | |
| ح | হ় | ḥ | throat |
| خ | খ় | kh | throat |
| د | দ | d | |
| ذ | য | dh | foreign |
| ر | র | r | |
| ز | জ় | z | foreign |
| س | স | s | |
| ش | শ | sh | |
| ص | স় | ṣ | heavy |
| ض | দ় | ḍ | heavy |
| ط | ত় | ṭ | heavy |
| ظ | য | ẓ | heavy |
| ع | vowel letter + ় (see §3) | ʿ | throat |
| غ | গ় | gh | throat |
| ف | ফ় | f | foreign |
| ق | ক় | q | heavy |
| ك | ক | k | |
| ل | ল | l | |
| م | ম | m | |
| ن | ন | n | |
| ه | হ | h | |
| ة | ত | t | |
| و (consonant) | ওয় | w | |
| ي (consonant) | য় | y | |
| ء / أ / إ | vowel letter, no nukta | ʾ | |

**Known collision (text level):** ذ and ظ are both written য. They differ only by `tag` (foreign vs heavy), so the UI
must colour them differently. Reviewer: please confirm or propose a better convention.

## 2. Vowels
| Arabic | After a consonant | Independent (hamza/ʿayn/wasla carrier) | Latin |
|---|---|---|---|
| fatha | (bare consonant) | আ | a |
| damma | ু | উ | u |
| kasra | ি | ই | i |
| long ā (alef, dagger alef, ى, آ) | া | আ | ā |
| long ū (damma + و) | ূ | ঊ | ū |
| long ī (kasra + ي) | ী | ঈ | ī |

**Caveat 1, inherent vowel.** A bare Bangla consonant is often read ɔ/o by Bangla speakers, while fatha is [a].
This is a known weakness of the convention. The audio, not the spelling, is the authority.
**Caveat 2.** Independent short a and long ā are both আ. The Latin line and the madd flag tell them apart.
Lengths in counts (2, 4 or 6) are **not** encoded.

## 3. ʿAyn and hamza
- Onset: ʿayn is written as the vowel letter plus nukta, tagged `throat`. Examples: আ় ঈ় উ় (ʿa, ʿī, ʿu).
- Hamza onset: the vowel letter with no nukta.
- Coda (with sukun): hamza ঽ, ʿayn ঽ় (avagraha as a placeholder, because Bangla has no sound for it). **Reviewer: confirm.**

## 4. Sukun, shaddah, tanween, madd
- **Sukun:** consonant + hasanta (্) appended to the previous syllable. Example: বিস্ (bis).
- **Shaddah:** the first half closes the previous syllable and the second half opens the next. Example: রব্ | বি (rab-bi).
- **Tanween:** vowel + ন্. Examples: -un → ু+ন্, -an → bare+ন্, -in → ি+ন্. An alef after fathatan is silent.
  The pausal form (waqf) is not modelled.
- **Madd:**
  - Alef after fatha, waw after damma, and ya after kasra lengthen the vowel.
  - Dagger alef, small waw (ۥ) and small ya (ۦ) lengthen the vowel.
  - آ gives a `madd` note.
  - Alef maksura (ى) after fatha is ā.
  - The alef after a final waw (قَالُوا) is silent.
- **Diphthongs:** waw or ya with sukun after fatha. aw is written ও and ay is written ই. Example: য়ও-মি (yaw-mi).

## 5. Hamzat wasl and the definite article
At the start of a word, ٱ is read as:
- আ before ل (al-). Example: আল্.
- উ if the third letter carries damma (ٱدْعُ = ud).
- Otherwise ই (ٱهْدِنَا = ih).

Inside a longer phrase wasl is dropped. This engine is word-level and always reads the word as if it were starting.

## 6. Sun letters and assimilation
A letter with **no mark** followed by a shaddah'd letter is assimilated and not written. This covers the lam of ٱلرَّحْمَٰنِ,
and idgham marked in the Uthmani text. The doubling shows up in the next letter (§4). A `assimilated-lam` or
`assimilated` note is recorded.

## 7. The word الله
Written without an explicit alef, lam + shaddah before ه is read as long ā (ٱللَّهِ, لِلَّهِ, وَٱللَّهِ = al-lā-hi, lil-lā-hi).
It is a lexical exception in `markLexicalLongA`. Heavy (tafkhim) versus light (tarqiq) lam is **not** modelled.

## 8. Idgham, ikhfa, iqlab, izhar (annotation only)
`annotateAyah(words)` adds notes. It **does not change the Bangla spelling**.

| Case | Note |
|---|---|
| nun sakin or tanween before ي ن م و | idgham with ghunna |
| before ل ر | idgham without ghunna |
| before ب | iqlab |
| before the 15 ikhfa letters (ت ث ج د ذ ز س ش ص ض ط ظ ف ق ك) | ikhfa |
| before throat letters or anything else | izhar |
| mim sakin before م | idgham shafawi |
| mim sakin before ب | ikhfa shafawi |
| mim sakin before any other letter | izhar shafawi |

Cross-word rules ignore waqf and ayah ends. An ayah's last word gets no cross-word rule. Wasla is skipped when looking
at the next word's first letter.

## 9. Not modelled (reviewer should know)
Qalqalah, ghunna length, rawm and ishmam, silat of the ha pronoun (هُ and هِ between voweled letters), pausal
forms (waqf), the full tafkhim/tarqiq rules for ر and ل, madd lengths and types (muttasil/munfasil/lazim),
and recitation-specific variants other than Hafs.

## 10. Verification status
- Al-Fatiha: 29 word instances in 7 ayahs, covered by golden tests. Expected values were derived by hand before running the code.
- Not yet reviewed by a scholar.
- Words outside Al-Fatiha are covered only by synthetic rule tests until Juz Amma goldens are added with reviewer help.
