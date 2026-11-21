import type { Lang } from '../i18n';
import { LETTERS, letterName } from './letters';

/**
 * Turns a finding from the reading check ("ع was heard as ح") into a plain explanation: WHERE each sound is made and what
 * differs. Rule-based, not AI: it is a table of articulation points (makhraj). Draft: a qualified teacher should review it.
 */
export interface FindingLike { type: string; expected?: string | null; heard?: string | null; letter?: string | null }

type Place = 'deepThroat' | 'midThroat' | 'topThroat' | 'backTongueDeep' | 'backTongueFront' | 'midTongue' | 'sideTongue' | 'tongueTip' | 'tipTeethRoot' | 'tipTeethLower' | 'tipBetweenTeeth' | 'lipTeeth' | 'lips';

const PLACE_OF: Record<string, Place> = {
  'ء': 'deepThroat', 'ه': 'deepThroat', 'ع': 'midThroat', 'ح': 'midThroat', 'غ': 'topThroat', 'خ': 'topThroat',
  'ق': 'backTongueDeep', 'ك': 'backTongueFront', 'ج': 'midTongue', 'ش': 'midTongue', 'ي': 'midTongue',
  'ض': 'sideTongue', 'ل': 'sideTongue', 'ن': 'tongueTip', 'ر': 'tongueTip',
  'ط': 'tipTeethRoot', 'د': 'tipTeethRoot', 'ت': 'tipTeethRoot',
  'ص': 'tipTeethLower', 'س': 'tipTeethLower', 'ز': 'tipTeethLower',
  'ظ': 'tipBetweenTeeth', 'ذ': 'tipBetweenTeeth', 'ث': 'tipBetweenTeeth',
  'ف': 'lipTeeth', 'ب': 'lips', 'م': 'lips', 'و': 'lips',
};
const HEAVY = new Set(['خ', 'ص', 'ض', 'غ', 'ط', 'ق', 'ظ']);

const PLACE: Record<Lang, Record<Place, string>> = {
  en: {
    deepThroat: 'the bottom of the throat', midThroat: 'the middle of the throat', topThroat: 'the top of the throat (near the mouth)',
    backTongueDeep: 'the very back of the tongue against the soft palate', backTongueFront: 'the back of the tongue, a little further forward',
    midTongue: 'the middle of the tongue against the roof of the mouth', sideTongue: 'the side edge of the tongue', tongueTip: 'the tip of the tongue',
    tipTeethRoot: 'the tip of the tongue at the base of the upper front teeth', tipTeethLower: 'the tip of the tongue near the lower front teeth (a whistling sound)',
    tipBetweenTeeth: 'the tip of the tongue between the teeth', lipTeeth: 'the lower lip touching the upper front teeth', lips: 'the lips',
  },
  bn: {
    deepThroat: 'কণ্ঠনালীর একদম গভীর থেকে', midThroat: 'কণ্ঠনালীর মাঝখান থেকে', topThroat: 'কণ্ঠনালীর উপরের অংশ (মুখের কাছ) থেকে',
    backTongueDeep: 'জিভের একদম পেছনের অংশ নরম তালুতে লাগিয়ে', backTongueFront: 'জিভের পেছনের অংশ, একটু সামনে থেকে',
    midTongue: 'জিভের মাঝের অংশ তালুতে লাগিয়ে', sideTongue: 'জিভের পাশের কিনারা থেকে', tongueTip: 'জিভের ডগা থেকে',
    tipTeethRoot: 'জিভের ডগা উপরের সামনের দাঁতের গোড়ায় লাগিয়ে', tipTeethLower: 'জিভের ডগা নিচের সামনের দাঁতের কাছে (শিসের মতো আওয়াজ)',
    tipBetweenTeeth: 'জিভের ডগা দুই দাঁতের মাঝে রেখে', lipTeeth: 'নিচের ঠোঁট উপরের সামনের দাঁতে লাগিয়ে', lips: 'ঠোঁট থেকে',
  },
  ar: {
    deepThroat: 'من أقصى الحلق', midThroat: 'من وسط الحلق', topThroat: 'من أدنى الحلق (قرب الفم)',
    backTongueDeep: 'من أقصى اللسان مع اللهاة', backTongueFront: 'من أقصى اللسان أقرب قليلًا إلى الفم',
    midTongue: 'من وسط اللسان مع الحنك', sideTongue: 'من حافة اللسان', tongueTip: 'من طرف اللسان',
    tipTeethRoot: 'من طرف اللسان مع أصول الثنايا العليا', tipTeethLower: 'من طرف اللسان قرب الثنايا السفلى (صفير)',
    tipBetweenTeeth: 'من طرف اللسان مع أطراف الثنايا العليا', lipTeeth: 'من الشفة السفلى مع أطراف الثنايا العليا', lips: 'من الشفتين',
  },
};

/** Pair-specific tips for the classic mix-ups, keyed "expected+heard". */
const PAIR_TIP: Record<Lang, Record<string, string>> = {
  en: {
    'عح': 'ʿayn (ع) is voiced and the throat tightens; ḥaa (ح) is only a breath of air.',
    'حع': 'ḥaa (ح) is only a breath of air; ʿayn (ع) needs voice and a tight throat.',
    'حه': 'ḥaa (ح) is a strong, rubbing breath from the middle of the throat; haa (ه) is a light breath from the bottom.',
    'هح': 'haa (ه) is a light breath from the bottom of the throat; do not rub it like ḥaa (ح).',
    'قك': 'qaaf (ق) is deeper and heavy; kaaf (ك) is lighter and further forward.',
    'كق': 'kaaf (ك) is light and further forward; do not pull it back like qaaf (ق).',
  },
  bn: {
    'عح': 'আইন (ع)-এ আওয়াজ হয় ও গলা চেপে আসে; হা (ح) শুধু শ্বাসের বাতাস।',
    'حع': 'হা (ح) শুধু শ্বাসের বাতাস; আইন (ع)-এ আওয়াজ লাগে ও গলা চেপে আসে।',
    'حه': 'হা (ح) কণ্ঠনালীর মাঝ থেকে জোরালো ঘষা শ্বাস; হা (ه) নিচ থেকে হালকা শ্বাস।',
    'هح': 'হা (ه) নিচ থেকে হালকা শ্বাস; হা (ح)-এর মতো ঘষবেন না।',
    'قك': 'ক্বাফ (ق) আরও গভীর ও মোটা; কাফ (ك) হালকা ও একটু সামনে।',
    'كق': 'কাফ (ك) হালকা ও একটু সামনে; ক্বাফ (ق)-এর মতো পেছনে টানবেন না।',
  },
  ar: {
    'عح': 'العين مجهورة ويضيق معها الحلق، أما الحاء فهمس بنفَس فقط.',
    'حع': 'الحاء همس بنفَس فقط، أما العين فتحتاج صوتًا وضيقًا في الحلق.',
    'حه': 'الحاء نفَس قوي محتكّ من وسط الحلق، والهاء نفَس خفيف من أقصى الحلق.',
    'هح': 'الهاء نفَس خفيف من أقصى الحلق، فلا تحتكّها كالحاء.',
    'قك': 'القاف أعمق ومفخّمة، والكاف أخفّ وأقرب إلى الفم.',
    'كق': 'الكاف خفيفة وأقرب إلى الفم، فلا ترجعها كالقاف.',
  },
};

const VOWEL: Record<Lang, Record<string, string>> = {
  en: { a: 'fatha (a)', u: 'damma (u)', i: 'kasra (i)', A: 'tanween fatha (-an)', U: 'tanween damma (-un)', I: 'tanween kasra (-in)', S: 'shaddah (doubled letter)', none: 'no vowel' },
  bn: { a: 'যবর', u: 'পেশ', i: 'যের', A: 'দুই যবর (তানউইন)', U: 'দুই পেশ (তানউইন)', I: 'দুই যের (তানউইন)', S: 'তাশদীদ (দ্বিত্ব)', none: 'কোনো হরকত নেই' },
  ar: { a: 'فتحة', u: 'ضمة', i: 'كسرة', A: 'تنوين فتح', U: 'تنوين ضم', I: 'تنوين كسر', S: 'شدّة', none: 'بلا حركة' },
};

const LINE = {
  en: {
    sub: (e: string, h: string, pe: string, ph: string) => `You said ${h} instead of ${e}. ${e} comes from ${pe}; ${h} comes from ${ph}.`,
    same: (e: string, h: string, p: string) => `You said ${h} instead of ${e}. Both come from ${p}, so the difference is in the quality of the sound.`,
    missing: (e: string) => `The letter ${e} was not heard.`,
    extra: (h: string) => `An extra letter ${h} was heard.`,
    vowel: (l: string, e: string, h: string) => `On the letter ${l}: it should be ${e}, but ${h} was heard.`,
    heavy: (hv: string, lt: string) => `${hv} is a heavy letter: keep the mouth full. ${lt} is light.`,
  },
  bn: {
    sub: (e: string, h: string, pe: string, ph: string) => `আপনি ${e}-এর জায়গায় ${h} বলেছেন। ${e} উচ্চারিত হয় ${pe}; ${h} উচ্চারিত হয় ${ph}।`,
    same: (e: string, h: string, p: string) => `আপনি ${e}-এর জায়গায় ${h} বলেছেন। দুটোই একই স্থান (${p}) থেকে, তাই পার্থক্য ধ্বনির গুণে।`,
    missing: (e: string) => `${e} হরফটি শোনা যায়নি।`,
    extra: (h: string) => `বাড়তি একটি ${h} হরফ শোনা গেছে।`,
    vowel: (l: string, e: string, h: string) => `${l} হরফে ${e} হওয়ার কথা, কিন্তু ${h} শোনা গেছে।`,
    heavy: (hv: string, lt: string) => `${hv} মোটা (ভারী) হরফ: মুখ ভরে উচ্চারণ করুন। ${lt} হালকা।`,
  },
  ar: {
    sub: (e: string, h: string, pe: string, ph: string) => `قلتَ ${h} بدل ${e}. يخرج ${e} ${pe}، ويخرج ${h} ${ph}.`,
    same: (e: string, h: string, p: string) => `قلتَ ${h} بدل ${e}. كلاهما يخرج ${p}، فالفرق في صفة الصوت.`,
    missing: (e: string) => `لم يُسمع حرف ${e}.`,
    extra: (h: string) => `سُمع حرف زائد ${h}.`,
    vowel: (l: string, e: string, h: string) => `على حرف ${l}: المطلوب ${e}، لكن سُمعت ${h}.`,
    heavy: (hv: string, lt: string) => `${hv} حرف مفخّم: املأ الفم بصوته. ${lt} مرقّق.`,
  },
} as const;

const nameOf = (ch: string, lang: Lang) => {
  const l = LETTERS.find((x) => x.ch === ch);
  return l ? `${ch} (${letterName(l, lang)})` : ch;
};

const vowelName = (marks: string | null | undefined, lang: Lang) =>
  !marks ? VOWEL[lang]['none']! : [...marks].map((m) => VOWEL[lang][m] ?? m).join(' + ');

/** Plain-language explanation of one finding, or a short generic line when we have no specific knowledge. */
export function explainFinding(f: FindingLike, lang: Lang): string {
  const L = LINE[lang];
  switch (f.type) {
    case 'Substitute': {
      const e = f.expected ?? '', h = f.heard ?? '';
      const pe = PLACE_OF[e], ph = PLACE_OF[h];
      const parts: string[] = [];
      if (pe && ph && pe !== ph) parts.push(L.sub(nameOf(e, lang), nameOf(h, lang), PLACE[lang][pe], PLACE[lang][ph]));
      else if (pe && ph) parts.push(L.same(nameOf(e, lang), nameOf(h, lang), PLACE[lang][pe]));
      else parts.push(lang === 'en' ? `You said ${nameOf(h, lang)} instead of ${nameOf(e, lang)}.` : lang === 'bn' ? `আপনি ${nameOf(e, lang)}-এর জায়গায় ${nameOf(h, lang)} বলেছেন।` : `قلتَ ${nameOf(h, lang)} بدل ${nameOf(e, lang)}.`);
      const tip = PAIR_TIP[lang][e + h];
      if (tip) parts.push(tip);
      else if (HEAVY.has(e) !== HEAVY.has(h) && pe && ph) parts.push(HEAVY.has(e) ? L.heavy(nameOf(e, lang), nameOf(h, lang)) : L.heavy(nameOf(h, lang), nameOf(e, lang)));
      return parts.join(' ');
    }
    case 'Missing': return L.missing(nameOf(f.expected ?? '', lang));
    case 'Extra': return L.extra(nameOf(f.heard ?? '', lang));
    case 'Vowel': return L.vowel(nameOf(f.letter ?? '', lang), vowelName(f.expected, lang), vowelName(f.heard, lang));
    default: return '';
  }
}
