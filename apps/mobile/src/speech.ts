import * as Speech from 'expo-speech';

/** Spoken Arabic for everyday words (the phone's own voice, not a recording; never used for the Quran). Resolves false when the phone has no Arabic voice. */
export async function speakArabic(text: string): Promise<boolean> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    if (!voices.some((v) => v.language.toLowerCase().startsWith('ar'))) return false;
    Speech.stop();
    Speech.speak(text, { language: 'ar-SA', rate: 0.85 });
    return true;
  } catch { return false; }
}
