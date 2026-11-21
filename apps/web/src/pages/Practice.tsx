import { Link } from 'react-router-dom';
import { useSettings } from '../settings';
import type { Key } from '@quran-shikkha/learning-core';
import { PageHero } from '../components/PageHero';

const MODES: { to: string; icon: string; title: Key; desc: Key }[] = [
  { to: 'chart', icon: 'ا ب ت', title: 'pChart', desc: 'pChartDesc' },
  { to: 'write', icon: '✎', title: 'pWrite', desc: 'pWriteDesc' },
  { to: 'trace', icon: '✍', title: 'pTrace', desc: 'pTraceDesc' },
  { to: 'quiz', icon: '؟', title: 'pQuiz', desc: 'pQuizDesc' },
  { to: 'match', icon: '⇄', title: 'pMatch', desc: 'pMatchDesc' },
  { to: 'build', icon: 'الله', title: 'pBuild', desc: 'pBuildDesc' },
];

export default function Practice() {
  const { t } = useSettings();
  return (
    <div>
      <PageHero compact overline={t('practice')} title={t('practice')} sub={t('practiceIntro')} aside={<div className="hero-name-ar ar" lang="ar" aria-hidden="true">ا ب ت</div>} />
      <ul className="list">
        {MODES.map((m) => (
          <li key={m.to}>
            <Link to={`/practice/${m.to}`} className="card-link practice-card">
              <span className="ar practice-icon" lang="ar" aria-hidden="true">{m.icon}</span>
              <span><strong className="lesson-title">{t(m.title)}</strong><br /><span className="meta">{t(m.desc)}</span></span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="hint">{t('namesReview')}</p>
    </div>
  );
}
