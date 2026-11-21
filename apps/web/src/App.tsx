import { lazy, Suspense } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
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
const Write = lazy(() => import('./pages/practice/Write'));
const TafsirPage = lazy(() => import('./pages/TafsirPage'));

export default function App() {
  const { t } = useSettings();
  return (
    <>
      <a className="skip" href="#main">{t('skip')}</a>
      <header className="top">
        <div className="top-inner">
          <NavLink to="/" className="brand">{t('appName')}</NavLink>
          <nav aria-label="main" className="nav">
            <NavLink to="/" end>{t('home')}</NavLink>
            <NavLink to="/practice">{t('practice')}</NavLink>
            <NavLink to="/frequent">{t('navWords')}</NavLink>
            <NavLink to="/flashcards">{t('flashcards')}</NavLink>
            <NavLink to="/credits">{t('credits')}</NavLink>
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
      <footer className="foot">{t('disclaimer')}</footer>
    </>
  );
}
