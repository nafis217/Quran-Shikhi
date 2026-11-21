import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  VOCAB, categoryName, isBuilt, isVocabMatch, makeVocabMatch, makeVocabQuestion, meaningOf, newBuild, tapTile, toBuildWord, wordsOf,
  type CategoryId, type VocabCard, type VocabQuestion, type VocabQuizKind, type VocabWord,
} from '@quran-shikkha/learning-core';
import { addStar, getLearn, setSpeedBest } from '../lib/learnProgress';
import { speakArabic } from '../lib/speech';
import { useSettings } from '../settings';

const SPEED_SECONDS = 60;

function Pool({ cat, children }: { cat: string; children: (pool: VocabWord[]) => React.ReactNode }) {
  const { t, lang } = useSettings();
  const pool = cat === 'all' ? [...VOCAB] : wordsOf(cat as CategoryId);
  return (
    <div>
      <Link className="back" to={cat === 'all' ? '/learn' : `/learn/${cat}`}>← {cat === 'all' ? t('dailyArabic') : categoryName(cat as CategoryId, lang)}</Link>
      {children(pool)}
    </div>
  );
}

/** The question area, by kind of question. */
function Prompt({ q }: { q: VocabQuestion }) {
  const { t, lang } = useSettings();
  switch (q.kind) {
    case 'picture-to-word': return <div className="pic-q" aria-label={q.target.en} role="img">{q.target.emoji}</div>;
    case 'listen-to-picture': return <button className="btn" onClick={() => speakArabic(q.target.ar)}>🔊 {t('speak')}</button>;
    case 'word-to-picture':
    case 'word-to-meaning': return <div className="ar huge" lang="ar" dir="rtl">{q.target.ar}</div>;
    default: return <div className="chip-pron big-name" lang={lang === 'bn' ? 'bn' : 'en'}>{meaningOf(q.target, lang)}</div>;
  }
}

function OptionFace({ kind, w }: { kind: VocabQuizKind; w: VocabWord }) {
  const { lang } = useSettings();
  if (kind === 'word-to-picture' || kind === 'listen-to-picture') return <span className="opt-emoji" aria-label={w.en} role="img">{w.emoji}</span>;
  if (kind === 'word-to-meaning') return <span lang={lang === 'bn' ? 'bn' : 'en'}>{meaningOf(w, lang)}</span>;
  return <span className="opt-ar" lang="ar" dir="rtl">{w.ar}</span>;
}

/** Quiz used by the picture quiz, listen-and-pick, meaning quiz. Every right answer earns a star. */
function Quiz({ pool, kinds, title }: { pool: VocabWord[]; kinds: VocabQuizKind[]; title: string }) {
  const { t, lang } = useSettings();
  const make = () => makeVocabQuestion(kinds[Math.floor(Math.random() * kinds.length)]!, pool, lang);
  const [q, setQ] = useState<VocabQuestion>(make);
  const [picked, setPicked] = useState<VocabWord | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });

  useEffect(() => { if (q.kind === 'listen-to-picture') speakArabic(q.target.ar); }, [q]);

  const pick = (w: VocabWord) => {
    if (picked) return;
    setPicked(w);
    const ok = w.id === q.target.id;
    if (ok) addStar();
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }));
  };
  const next = () => { setQ(make()); setPicked(null); };

  return (
    <>
      <h1>{title}</h1>
      <p className="meta">{t('score')}: {score.right} / {score.total} · <span className="stars">⭐ {getLearn().stars}</span></p>
      <section className="card quiz">
        <Prompt q={q} />
        <div className="options">
          {q.options.map((o) => {
            const right = o.id === q.target.id;
            return (
              <button key={o.id} className="btn option" disabled={!!picked && !right && picked.id !== o.id}
                data-state={picked ? (right ? 'right' : picked.id === o.id ? 'wrong' : undefined) : undefined} onClick={() => pick(o)}>
                <OptionFace kind={q.kind} w={o} />
              </button>
            );
          })}
        </div>
        <p role="status" aria-live="polite" className="notice-line">
          {picked ? (picked.id === q.target.id ? '✅ ' + t('correct') : `❌ ${t('wrong')} — ${q.target.ar} · ${meaningOf(q.target, lang)}`) : ''}
        </p>
        {picked && <button className="btn primary" onClick={next}>{t('next')} →</button>}
      </section>
    </>
  );
}

function MemoryMatch({ pool }: { pool: VocabWord[] }) {
  const { t, age } = useSettings();
  const pairs = Math.min(age === 'kids' ? 6 : 8, pool.filter((w) => w.visual).length);
  const [cards, setCards] = useState<VocabCard[]>(() => makeVocabMatch(pairs, pool));
  const [open, setOpen] = useState<VocabCard[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);
  const won = cards.length > 0 && done.size === cards.length / 2;
  const rewarded = useRef(false);
  useEffect(() => { if (won && !rewarded.current) { rewarded.current = true; addStar(3); } }, [won]);

  const restart = () => { setCards(makeVocabMatch(pairs, pool)); setOpen([]); setDone(new Set()); setMoves(0); rewarded.current = false; };
  const tap = (c: VocabCard) => {
    if (done.has(c.pairId) || open.some((o) => o.key === c.key) || open.length === 2) return;
    if (c.kind === 'word') { const w = VOCAB.find((v) => v.id === c.pairId); if (w) speakArabic(w.ar); }
    const next = [...open, c]; setOpen(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      if (isVocabMatch(next[0]!, next[1]!)) { setDone((d) => new Set(d).add(c.pairId)); setOpen([]); } else setTimeout(() => setOpen([]), 900);
    }
  };

  if (cards.length === 0) return <p className="state">{t('empty')}</p>;
  return (
    <>
      <h1>{t('gMatch')}</h1>
      <p className="meta">{moves} · {done.size} / {cards.length / 2}</p>
      <div className="match-grid">
        {cards.map((c) => {
          const shown = done.has(c.pairId) || open.some((o) => o.key === c.key);
          return (
            <button key={c.key} className="match-card" data-open={shown || undefined} data-done={done.has(c.pairId) || undefined} onClick={() => tap(c)} aria-label={shown ? c.text : '?'}>
              {shown ? (c.kind === 'picture' ? <span className="opt-emoji">{c.text}</span> : <span className="opt-ar" lang="ar" dir="rtl">{c.text}</span>) : '?'}
            </button>
          );
        })}
      </div>
      <p role="status" aria-live="polite" className="notice-line">{won ? '🎉 ' + t('allMatched') : ''}</p>
      <button className="btn" onClick={restart}>{t('newRound')}</button>
    </>
  );
}

function Spell({ pool }: { pool: VocabWord[] }) {
  const { t, lang } = useSettings();
  const pick = () => pool[Math.floor(Math.random() * pool.length)]!;
  const [word, setWord] = useState<VocabWord>(pick);
  const pw = useMemo(() => toBuildWord(word), [word]);
  const [state, setState] = useState(() => newBuild(pw));
  const done = isBuilt(state);
  const [nudge, setNudge] = useState(false);
  const rewarded = useRef('');
  useEffect(() => { if (done && rewarded.current !== word.id) { rewarded.current = word.id; addStar(2); speakArabic(word.ar); } }, [done, word]);
  const next = () => { const w = pick(); setWord(w); setState(newBuild(toBuildWord(w))); setNudge(false); };
  const tapLetter = (id: number) => setState((s) => { const n = tapTile(s, id); setNudge(n.mistakes > s.mistakes); return n; });

  return (
    <>
      <h1>{t('gSpell')}</h1>
      <p className="hint">{t('buildPrompt')}</p>
      <section className="card quiz">
        {word.visual && <div className="pic-q" role="img" aria-label={word.en}>{word.emoji}</div>}
        <p className="chip-pron" lang={lang === 'bn' ? 'bn' : 'en'}>{meaningOf(word, lang)}</p>
        <div className="built" dir="rtl" lang="ar" aria-live="polite" aria-label={state.target.slice(0, state.placed).join(' ')}>
          {state.target.map((_, i) => <span key={i} className="slot ar big" data-filled={i < state.placed || undefined}>{state.target[i]!.slice(0, i < state.placed ? 3 : 0)}</span>)}
        </div>
        <div className="tiles" dir="rtl">
          {state.tiles.map((tile) => <button key={tile.id} className="tile ar big" lang="ar" disabled={tile.used} onClick={() => tapLetter(tile.id)}>{tile.ch}</button>)}
        </div>
        <p role="status" aria-live="polite" className="notice-line">{nudge && !done ? '↺ ' + t('wrong') : ''}</p>
        {done && <div role="status" className="notice good">🎉 {t('correct')}<div className="ar huge" lang="ar" dir="rtl">{word.ar}</div></div>}
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn" onClick={() => { setState(newBuild(pw)); setNudge(false); }}>{t('reset')}</button>
          <button className="btn primary" onClick={next}>{t('next')} →</button>
        </div>
      </section>
    </>
  );
}

/** 60 seconds, as many correct answers as you can. For teens and adults. */
function Speed({ pool }: { pool: VocabWord[] }) {
  const { t, lang } = useSettings();
  const kinds = useMemo<VocabQuizKind[]>(() => (pool.some((w) => w.visual) ? ['picture-to-word', 'word-to-meaning', 'meaning-to-word'] : ['word-to-meaning', 'meaning-to-word']), [pool]);
  const make = () => makeVocabQuestion(kinds[Math.floor(Math.random() * kinds.length)]!, pool, lang);
  const [left, setLeft] = useState(SPEED_SECONDS);
  const [running, setRunning] = useState(false);
  const [q, setQ] = useState<VocabQuestion>(make);
  const [score, setScore] = useState(0);
  const [flash, setFlash] = useState<'right' | 'wrong' | null>(null);
  const [record, setRecord] = useState(false);
  const over = running && left <= 0;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  useEffect(() => { if (over) { setRunning(false); setRecord(setSpeedBest(score)); addStar(Math.floor(score / 3)); } }, [over]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => { setScore(0); setLeft(SPEED_SECONDS); setQ(make()); setRecord(false); setRunning(true); };
  const answer = (w: VocabWord) => {
    if (!running || flash) return;
    const ok = w.id === q.target.id;
    if (ok) setScore((s) => s + 1);
    setFlash(ok ? 'right' : 'wrong');
    setTimeout(() => { setFlash(null); setQ(make()); }, 450);
  };

  if (!running) {
    return (
      <>
        <h1>⏱️ {t('gSpeed')}</h1>
        <section className="card quiz">
          {left <= 0 && <><h2>{t('roundOver')}</h2><p className="chip-pron">{t('score')}: {score}{record ? ' 🏆' : ''}</p></>}
          <p className="meta">{t('gSpeedDesc')} · {t('bestScore')}: {getLearn().speedBest}</p>
          <button className="btn primary" onClick={start}>{left <= 0 ? t('newRound') : t('play')}</button>
        </section>
      </>
    );
  }
  return (
    <>
      <h1>⏱️ {t('gSpeed')}</h1>
      <p className="timer" aria-live="off">{t('timeLeft')}: {left}s · {t('score')}: {score}</p>
      <div className="timer-bar" aria-hidden="true"><i style={{ width: `${(100 * left) / SPEED_SECONDS}%` }} /></div>
      <section className="card quiz" data-flash={flash || undefined}>
        <Prompt q={q} />
        <div className="options">
          {q.options.map((o) => (
            <button key={o.id} className="btn option" data-state={flash ? (o.id === q.target.id ? 'right' : undefined) : undefined} onClick={() => answer(o)}>
              <OptionFace kind={q.kind} w={o} />
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

export default function LearnPlay() {
  const { game } = useParams();
  const [params] = useSearchParams();
  const cat = params.get('cat') ?? 'all';
  const { t } = useSettings();

  return (
    <Pool cat={cat}>
      {(pool) => {
        const hasPictures = pool.some((w) => w.visual);
        if (pool.length < 4) return <p className="state">{t('empty')}</p>;
        switch (game) {
          case 'picture': return hasPictures ? <Quiz pool={pool} kinds={['picture-to-word', 'word-to-picture']} title={t('gPicture')} /> : <p className="state">{t('empty')}</p>;
          case 'listen': return hasPictures ? <Quiz pool={pool} kinds={['listen-to-picture']} title={t('gListen')} /> : <p className="state">{t('empty')}</p>;
          case 'match': return hasPictures ? <MemoryMatch pool={pool} /> : <p className="state">{t('empty')}</p>;
          case 'spell': return <Spell pool={pool} />;
          case 'meaning': return <Quiz pool={pool} kinds={['word-to-meaning', 'meaning-to-word']} title={t('gMeaning')} />;
          case 'speed': return <Speed pool={pool} />;
          default: return <p className="state">404</p>;
        }
      }}
    </Pool>
  );
}
