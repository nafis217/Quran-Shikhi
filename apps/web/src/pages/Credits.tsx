import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useSettings } from '../settings';
import { Async } from '../components/States';
import { PageHero } from '../components/PageHero';

export default function Credits() {
  const { t } = useSettings();
  const [state, retry] = useAsync(async () => {
    const r = await api.GET('/api/v1/credits');
    if (!r.data) throw new Error('credits');
    return r.data;
  }, []);

  return (
    <div>
      <PageHero compact title={t('credits')} aside={<div className="hero-emoji" aria-hidden="true">🤝</div>} />
      <Async state={state} retry={retry}>
        {(c) => (
          <>
            <ul className="list">
              {c.sources.map((s) => (
                <li key={s.name} className="card">
                  <strong>{s.name}</strong>
                  <p>{s.what}</p>
                  <a href={s.url} rel="noopener noreferrer" target="_blank">{s.url}</a>
                </li>
              ))}
              <li className="card"><strong>{t('reciter')}</strong><p>{c.reciter ?? '—'}</p></li>
              <li className="card">
                <strong>{t('aboutCheck')}</strong>
                <p>{t('recLimitsLocal')}</p>
                <p>🔒 {t('recPrivacyLocal')} · {t('recPrivacy')}</p>
              </li>
              <li className="card">
                <strong>{t('fonts')}</strong>
                <p>Noto Sans Bengali (SIL OFL 1.1), Amiri Quran (SIL OFL 1.1)</p>
              </li>
            </ul>
          </>
        )}
      </Async>
    </div>
  );
}
