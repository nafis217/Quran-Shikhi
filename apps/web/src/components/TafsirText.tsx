import DOMPurify from 'dompurify';
import { Clamp } from './Clamp';

/** Tafsir text exactly as the source gives it; HTML is sanitised only (the wording is never changed). */
export function TafsirText({ text, lang }: { text: string; lang: string }) {
  return <Clamp long={text.length > 700}><div className="tafsir" lang={lang} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(text) }} /></Clamp>;
}
