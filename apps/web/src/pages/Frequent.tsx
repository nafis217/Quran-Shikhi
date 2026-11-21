import { pickByLang, pronScript, pronText } from '@quran-shikkha/learning-core';
import type { Word } from '@quran-shikkha/api-client';
import { api } from '../lib/api';
import { pron } from '../lib/pron';
import { useAsync } from '../lib/useAsync';
import { useWordInteraction } from '../lib/useWordInteraction';
import { useSettings } from '../settings';
import { WordChip } from '../components/WordChip';
import { Async, Empty } from '../components/States';

/** The ~300 most common words of the whole Quran, each with its Bangla and English meaning. Coverage is computed from the data. */
export default function Frequent() {
  const { t, lang, showPron } = useSettings();
  const wi = useWordInteraction();
  const [state, retry] = useAsync(async () => {
    const r = await api.GET('/api/v1/tracks/frequent', { params: { query: { size: 300 } } });
    if (!r.data) throw new Error('track');
    return r.data;
  }, []);

  return (
    <div>
      <h1>{t('frequent')}</h1>
      <Async state={state} retry={retry}>
        {(d) => d.words.length === 0 ? <Empty /> : (
          <>
            <p className="coverage" aria-live="polite">
              {d.words.length} {t('wordsCount')} · {t('coverage')} <strong>{d.coveragePercent}%</strong> {t('coverageOf')}
              <span className="meta"> ({d.totalWordTokens.toLocaleString()} · {d.distinctWords.toLocaleString()})</span>
            </p>
            <ol className="freq">
              {d.words.map((w) => {
                const word: Word = { key: w.exampleKey, position: 0, arabicText: w.arabicText, audioPath: w.audioPath ?? null, meaningBn: w.meaningBn ?? null, meaningEn: w.meaningEn ?? null, translitLatin: null, charType: 'word' };
                const primary = pickByLang(lang, w.meaningBn, w.meaningEn);
                const other = lang === 'bn' ? w.meaningEn : w.meaningBn;
                const p = pron(w.arabicText);
                return (
                  <li key={w.rank}>
                    <button className="freq-row" onClick={() => wi.tap(word)} aria-label={`${w.rank}. ${w.arabicText}. ${primary ?? ''}`}>
                      <span className="rank">{w.rank}</span>
                      <span className="ar" lang="ar" dir="rtl">{w.arabicText}</span>
                      <span className="freq-mean">
                        <b lang={lang === 'bn' ? 'bn' : 'en'}>{primary ?? t('noMeaning')}</b>
                        {other && other !== primary && <span lang={lang === 'bn' ? 'en' : 'bn'}>{other}</span>}
                        {showPron && <span lang={pronScript(lang) === 'bn' ? 'bn' : 'en'}>{pronText(p, lang)}</span>}
                      </span>
                      <span className="meta">{w.count.toLocaleString()} {t('count')} · {w.cumulativeCoveragePercent}%</span>
                    </button>
                    {wi.selected?.key === w.exampleKey && wi.selected.arabicText === w.arabicText && (
                      <WordChip word={wi.selected} notice={wi.notice} onListen={(x) => void wi.listen(x)} onBreak={(x) => void wi.breakDown(x)} onClose={wi.clear} />
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </Async>
    </div>
  );
}
