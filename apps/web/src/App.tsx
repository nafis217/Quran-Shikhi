import { lazy, Suspense, useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useSettings } from './settings';
import { SettingsPanel } from './components/SettingsPanel';
import { Loading } from './components/States';
import Home from './pages/Home';

const Reader = lazy(() => import('./pages/Reader'));
const FamiliarLesson = lazy(() => import('./pages/FamiliarLesson'));
const Frequent = lazy(() => import('./pages/Frequent'));
const Flashcards = lazy(() => import('./pages/Flashcards'));
const Credits = lazy(() => import('./pages/Credits'));
const Practice = lazy(() => import('./pages/Practice'));
const Chart = lazy(() => import('./pages/practice/Chart'));
const Trace = lazy(() => import('./pages/practice/Trace'));
const Quiz = lazy(() => import('./pages/practice/Quiz'));
const Match = lazy(() => import('./pages/practice/Match'));
const Build = lazy(() => import('./pages/practice/Build'));
const PlanPage = lazy(() => import('./pages/PlanPage'));
const Learn = lazy(() => import('./pages/Learn'));
const LearnCategory = lazy(() => import('./pages/LearnCategory'));
const LearnPlay = lazy(() => import('./pages/LearnPlay'));
const Watch = lazy(() => import('./pages/Watch'));
const Write = lazy(() => import('./pages/practice/Write'));
const TafsirPage = lazy(() => import('./pages/TafsirPage'));

export default function App() {
  const { t } = useSettings();
  const [menu, setMenu] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setMenu(false), [pathname]); // close the menu after choosing a page
  useEffect(() => {
    if (!menu) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [menu]);
  return (
    <>
      <a className="skip" href="#main">{t('skip')}</a>
      <header className="top">
        <div className="top-inner">
          <NavLink to="/" className="brand"><svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="bm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--ring-a)" /><stop offset="1" stopColor="var(--ring-b)" /></linearGradient></defs><path d="M16 2l4 9 9 3-9 4-4 9-4-9-9-4 9-3z" fill="url(#bm)" /><circle cx="16" cy="16" r="2.6" fill="var(--surface)" /></svg>{t('appName')}</NavLink>
          <button type="button" className="menu-btn" aria-expanded={menu} aria-controls="main-nav" aria-label={t('menu')} onClick={() => setMenu((v) => !v)}><span /><span /><span /></button>
          <nav aria-label="main" className={`nav${menu ? ' open' : ''}`} id="main-nav">
            <NavLink to="/" end>{t('home')}</NavLink>
            <NavLink to="/plan">{t('myPlan')}</NavLink>
            <NavLink to="/learn">{t('dailyArabic')}</NavLink>
            <NavLink to="/watch">{t('watchRead')}</NavLink>
            <NavLink to="/practice">{t('practice')}</NavLink>
            <NavLink to="/flashcards">{t('flashcards')}</NavLink>
          </nav>
          <SettingsPanel />
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/surah/:n" element={<Reader />} />
            <Route path="/surah/:n/tafsir" element={<TafsirPage />} />
            <Route path="/lesson/:id" element={<FamiliarLesson />} />
            <Route path="/frequent" element={<Frequent />} />
            <Route path="/flashcards" element={<Flashcards />} />
            <Route path="/credits" element={<Credits />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/learn/play/:game" element={<LearnPlay />} />
            <Route path="/learn/:cat" element={<LearnCategory />} />
            <Route path="/watch" element={<Watch />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/practice/chart" element={<Chart />} />
            <Route path="/practice/trace" element={<Trace />} />
            <Route path="/practice/write" element={<Write />} />
            <Route path="/practice/quiz" element={<Quiz />} />
            <Route path="/practice/match" element={<Match />} />
            <Route path="/practice/build" element={<Build />} />
            <Route path="*" element={<p className="state">404</p>} />
          </Routes>
        </Suspense>
      </main>
      <footer className="foot">{t('disclaimer')} · <NavLink to="/credits">{t('credits')}</NavLink></footer>
    </>
  );
}
