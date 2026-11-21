import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LETTERS, formsOf, letterName } from '@quran-shikkha/learning-core';
import { getPractice } from '../../lib/practiceProgress';
import { useSettings } from '../../settings';
import { Back } from './Back';

export default function Chart() {
  const { t, lang } = useSettings();
  const [sel, setSel] = useState(LETTERS[0]!.id);
  const l = LETTERS.find((x) => x.id === sel)!;
  const f = formsOf(l);
  const traced = getPractice().traced;
  const forms: [string, string][] = [[t('isolated'), f.isolated], [t('formInitial'), f.initial], [t('formMedial'), f.medial], [t('formFinal'), f.final]];

  return (
    <div>
      <Back />
      <h1>{t('pChart')}</h1>
      <section className="card letter-detail" aria-live="polite">
        <div className="detail-top">
          <span className="ar huge" lang="ar">{l.ch}</span>
          <div>
            <div className="chip-pron">{letterName(l, lang)}</div>
            <div className="meta" lang="ar">{l.ar} · {l.en} · /{l.latin}/</div>
            <Link className="btn small" to={`/practice/trace?letter=${l.id}`}>✍ {t('pTrace')}</Link>
          </div>
        </div>
        <div className="forms" role="list">
          {forms.map(([label, glyph]) => (
            <div key={label} role="listitem" className="form-cell">
              <span className="ar big" lang="ar">{glyph}</span>
              <span className="meta">{label}</span>
            </div>
          ))}
        </div>
        {!l.joinsNext && <p className="notice">{t('nonConnecting')}</p>}
      </section>
      <div className="letter-grid" role="list">
        {LETTERS.map((x) => (
          <button key={x.id} role="listitem" className="letter-btn" data-selected={x.id === sel || undefined} onClick={() => setSel(x.id)}
            aria-label={`${letterName(x, lang)} ${x.ar}`} aria-pressed={x.id === sel}>
            <span className="ar" lang="ar">{x.ch}</span>
            <span className="meta">{letterName(x, lang)}{traced[x.id] ? ' ✓' : ''}</span>
          </button>
        ))}
      </div>
      <p className="hint">{t('namesReview')}</p>
    </div>
  );
}
