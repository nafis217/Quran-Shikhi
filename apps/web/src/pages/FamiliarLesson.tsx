import { useParams } from 'react-router-dom';
import type { Word } from '@quran-shikkha/api-client';
import { pickByLang } from '@quran-shikkha/learning-core';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useWordInteraction } from '../lib/useWordInteraction';
import { useSettings } from '../settings';
import { WordButton } from '../components/WordButton';
import { WordChip } from '../components/WordChip';
import { Async } from '../components/States';

interface Item { labelBn: string; labelEn?: string | null; word?: Word | null }
interface Detail { title: string; titleEn: string; items: Item[] }

export default function FamiliarLesson() {
  const { id } = useParams();
  const { t, lang } = useSettings();
  const wi = useWordInteraction();
  const [state, retry] = useAsync(async () => {
    const r = await api.GET('/api/v1/lessons/{id}', { params: { path: { id: Number(id) } } });
    if (!r.data) throw new Error('lesson');
    return r.data as unknown as Detail;
  }, [id]);

  return (
    <div>
      <Async state={state} retry={retry}>
        {(d) => (
          <>
            <h1>{t('lessonFamiliar')}</h1>
            <p className="hint">{t('familiarIntro')} {t('tapHint')}</p>
            <ul className="list">
              {d.items.map((it, i) => (
                <li key={i} className="card">
                  <strong lang={lang}>{pickByLang(lang, it.labelBn, it.labelEn)}</strong>
                  {it.word ? (
                    <div className="words" dir="rtl">
                      <WordButton word={it.word} selected={wi.selected?.key === it.word.key} breakdown={wi.breakdown} onHover={wi.hover} onSingle={wi.tap} onDouble={(w) => void wi.breakDown(w)} />
                    </div>
                  ) : <p className="state">{t('notInScope')}</p>}
                  {wi.selected && it.word && wi.selected.key === it.word.key && (
                    <WordChip word={wi.selected} notice={wi.notice} onListen={(w) => void wi.listen(w)} onBreak={(w) => void wi.breakDown(w)} onClose={wi.clear} />
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </Async>
    </div>
  );
}
