import { Link, useParams } from 'react-router-dom';
import { CATEGORIES, categoryName, wordsOf, type CategoryId } from '@quran-shikkha/learning-core';
import { useArabicVoice } from '../lib/speech';
import { useSettings } from '../settings';
import { VocabCard } from '../components/VocabCard';
import { PageHero } from '../components/PageHero';

export default function LearnCategory() {
  const { cat } = useParams();
  const { t, lang } = useSettings();
  const hasVoice = useArabicVoice();
  const c = CATEGORIES.find((x) => x.id === cat);
  if (!c) return <p className="state">{t('empty')}</p>;
  const words = wordsOf(c.id as CategoryId);
  const visual = words.some((w) => w.visual);

  return (
    <div>
      <Link className="back" to="/learn">← {t('dailyArabic')}</Link>
      <PageHero compact overline={t('dailyArabic')} title={categoryName(c.id, lang)} sub={`${words.length} ${t('wordsCount2')}`} aside={<div className="hero-emoji" aria-hidden="true">{c.emoji}</div>} />
      <div className="row">
        {visual && <Link className="btn small" to={`/learn/play/picture?cat=${c.id}`}>🖼️ {t('gPicture')}</Link>}
        {visual && <Link className="btn small" to={`/learn/play/listen?cat=${c.id}`}>👂 {t('gListen')}</Link>}
        {visual && <Link className="btn small" to={`/learn/play/match?cat=${c.id}`}>🃏 {t('gMatch')}</Link>}
        <Link className="btn small" to={`/learn/play/spell?cat=${c.id}`}>🔤 {t('gSpell')}</Link>
        <Link className="btn small" to={`/learn/play/meaning?cat=${c.id}`}>❓ {t('gMeaning')}</Link>
      </div>
      {!hasVoice && <p className="notice" role="status">{t('noVoice')}</p>}
      <div className="vgrid">{words.map((w) => <VocabCard key={w.id} word={w} />)}</div>
    </div>
  );
}
