# The "teacher" features: what exists, what does not

## 1. Writing teacher (built, web only)
- You trace a letter over a faint guide. After **Check** you get a score, a heatmap (red = part of the letter you missed, orange = ink outside the letter) and a plain hint ("You missed the bottom part").
- Logic: `packages/learning-core/src/practice/trace.ts` (`scoreTrace`, `traceFeedback`), tested with synthetic masks.
- **Not checked:** stroke order, stroke direction, pen speed, and dot count/placement as separate things. A letter with its dots missing may still pass if enough of the body is covered. The thresholds (`PASS_COVERAGE`, `PASS_PRECISION`) are untuned and need real children's drawings to calibrate.
- Mobile: free drawing with a self-check button only. Pixel-based scoring needs a canvas.

## 2. Reading teacher (built, web)
Flow: you press **Read this ayah aloud** → the microphone is recorded → the audio goes to a Quran speech model **running on your own computer** (`services/asr`) → the transcript, which includes vowel marks, is compared with the real ayah word by word → every word is marked Correct / Vowel marks differ / Close / Not matching / Missed, with what was heard, a score, and buttons to hear the correct word.

Model: `tarteel-ai/whisper-base-ar-quran` (Apache-2.0), downloaded once from Hugging Face (~290 MB). **No training was needed to get this far.** It runs on the CPU of an 8 GB M1 in about 6 seconds for a short ayah.

If the local model is not running, the app falls back to the browser's recogniser (Chrome sends audio to Google; letters only, no vowels) and says so on screen.

### Measured on real audio (professional reciter Alafasy, all 7 ayahs of Al-Fatiha, 29 words)
- Correct reading: 29 of 29 words marked correct, score 100 on every ayah (**no false alarms**).
- Reading the wrong ayah: score 0, every word flagged.
- A recording with one word cut out: that exact word reported missed, score 75.
- Vowel changes (damma→fatha, missing shaddah): flagged in unit tests on synthetic transcripts.

### What this has NOT been tested on (important)
- **Real learner mistakes.** The model was trained on correct recitation, so it may "auto-correct" a mispronounced word into the right one and miss the error. We have not measured how often. This needs recordings of real learners (with consent) and a teacher's judgement.
- **Children's and non-native voices**, noisy rooms, cheap microphones.
- **Reciters other than Alafasy.**

### What it can and cannot judge
Can: skipped words, extra words, replaced words, different short vowels, tanween and shaddah.
Cannot: madd length, ghunna, qalqalah, idgham/ikhfa quality, makhraj (place of articulation), stopping rules. The UI says so. The score is a reading-accuracy score, **not a Tajweed grade**, and does not replace a qualified teacher.

### Run it
```bash
cd services/asr && ./.venv/bin/python -m uvicorn server:app --host 127.0.0.1 --port 8001
```
The backend finds it at `Asr:Url` (default `http://127.0.0.1:8001` in Development). The server binds to 127.0.0.1 only; audio is not stored.

## 3. Correction: what training is actually needed
An earlier version of this document said weeks of labelled data were needed. That is true only for **detecting specific Tajweed errors**, which needs examples of wrong recitation. For reading accuracy, a pre-trained Quran model plus correct recordings is enough, as shown above.

Possible next steps, in order of value:
1. **Measure on real learners.** Collect consented recordings (see privacy below) and have a teacher mark real mistakes. Count how many the checker catches. This decides whether any training is needed at all.
2. **Reference-based scoring.** Compare the learner's audio with a professional reciter's audio of the same ayah (alignment of sound features). Needs no mistake labels and can reveal timing/length differences such as madd.
3. **Fine-tune the model** on children's and non-native voices, or train a Tajweed classifier. This needs a GPU (Kaggle or a rented one; an 8 GB laptop is too small) and labelled data.

### Training data: license status
| Source | Status |
|---|---|
| `tarteel-ai/whisper-base-ar-quran` model | Apache-2.0. We use it as is. |
| `tarteel-ai/everyayah` dataset (derived from EveryAyah.com recordings) | **No license declared.** The recordings belong to the individual reciters. Do not train or redistribute until this is clarified. |
| Quran Foundation audio and text | Your brief forbids using it to train models. |
| Recordings of your own users | Allowed only with consent. For children, parental consent and a retention policy are needed first. |

I cannot log in to Kaggle for you (that needs your account). When you reach step 3, I can prepare the training notebook and data checks for you to run there.
