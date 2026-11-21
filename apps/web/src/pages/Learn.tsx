import { Link } from 'react-router-dom';
import { CATEGORIES, VOCAB, categoryName, wordOfTheDay, wordsOf } from '@quran-shikkha/learning-core';
import { getLearn } from '../lib/learnProgress';
import { useArabicVoice } from '../lib/speech';
import { useSettings, type Age } from '../settings';
import { VocabCard } from '../components/VocabCard';
import { PageHero } from '../components/PageHero';

const GAMES = [
  { id: 'picture', icon: '🖼️', title: 'gPicture', desc: 'gPictureDesc', ages: ['kids', 'teens', 'adults'] },
  { id: 'listen', icon: '👂', title: 'gListen', desc: 'gListenDesc', ages: ['kids', 'teens', 'adults'] },
  { id: 'match', icon: '🃏', title: 'gMatch', desc: 'gMatchDesc', ages: ['kids', 'teens', 'adults'] },
  { id: 'spell', icon: '🔤', title: 'gSpell', desc: 'gSpellDesc', ages: ['kids', 'teens', 'adults'] },
  { id: 'meaning', icon: '❓', title: 'gMeaning', desc: 'gMeaningDesc', ages: ['teens', 'adults'] },
  { id: 'speed', icon: '⏱️', title: 'gSpeed', desc: 'gSpeedDesc', ages: ['teens', 'adults'] },
] as const;

/** Everyday Arabic: pictures, sound and games. What comes first depends on the age group chosen in Settings. */
export default function Learn() {
  const { t, lang, age } = useSettings();
  const hasVoice = useArabicVoice();
  const stars = getLearn().stars;
  const games = GAMES.filter((g) => (g.ages as readonly Age[]).includes(age));

  const gameGrid = (
    <section>
      <h2>{t('games')}</h2>
      <div className="start-grid">
        {games.map((g) => (
          <Link key={g.id} to={`/learn/play/${g.id}`} className="start-card">
            <strong>{g.icon} {t(g.title)}</strong><span className="meta">{t(g.desc)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
  const categories = (
    <section>
      <h2>{t('categories')}</h2>
      <div className="cat-grid">
        {CATEGORIES.filter((c) => age !== 'kids' || c.id !== 'phrases').map((c) => (
          <Link key={c.id} to={`/learn/${c.id}`} className="cat-tile" data-first={(age !== 'kids' && c.id === 'phrases') || undefined}>
            <span className="cat-emoji" aria-hidden="true">{c.emoji}</span>
            <strong>{categoryName(c.id, lang)}</strong>
            <span className="meta">{wordsOf(c.id).length} {t('wordsCount2')}</span>
          </Link>
        ))}
      </div>
    </section>
  );
  const watch = (
    <Link to="/watch" className="start-card" style={{ marginTop: 'var(--s4)' }}>
      <strong>📺 {t('watchRead')}</strong><span className="meta">{t('watchIntro')}</span>
    </Link>
  );

  return (
    <div>
      <PageHero overline={t('dailyArabic')} title={t('dailyArabic')} sub={`${t('dailyIntro')} · ${VOCAB.length} ${t('wordsCount2')}${stars > 0 ? ` · ⭐ ${stars}` : ''}`} aside={<div className="hero-emoji" aria-hidden="true">🍎🐱🚗</div>} />
      {!hasVoice && <p className="notice" role="status">{t('noVoice')}</p>}

      <section>
        <h2>{t('wordOfDay')}</h2>
        <VocabCard word={wordOfTheDay()} big />
      </section>

      {age === 'kids' ? <>{gameGrid}{categories}{watch}</> : <>{categories}{gameGrid}{watch}</>}
      <p className="hint small-note" style={{ marginTop: 'var(--s4)' }}>{t('voiceNote')}</p>
    </div>
  );
}
