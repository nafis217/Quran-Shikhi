import { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import {
  LETTERS, PRACTICE_WORDS, formsOf, isBuilt, isCorrect, isMatch, joinedForm, letterName, makeMatch, makeQuestion, newBuild, tapTile,
  type Letter, type QuizMode,
} from '@quran-shikkha/learning-core';
import { useSettings } from '../settings';
import { Btn, Card, T } from '../components/Ui';

export type PracticeMode = 'menu' | 'chart' | 'write' | 'trace' | 'quiz' | 'match' | 'build';
const AR = 'AmiriQuran_400Regular';

function Arabic({ children, size = 40, color }: { children: string; size?: number; color?: string }) {
  const { colors: c, fontScale } = useSettings();
  return <Text style={{ fontFamily: AR, fontSize: size * fontScale, lineHeight: size * fontScale * 1.9, color: color ?? c.text, textAlign: 'center' }}>{children}</Text>;
}

function Chart() {
  const { t, lang, colors: c } = useSettings();
  const [sel, setSel] = useState<Letter>(LETTERS[0]!);
  const f = formsOf(sel);
  return (
    <View>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Arabic size={80}>{sel.ch}</Arabic>
          <View><T bold>{letterName(sel, lang)}</T><T style={{ color: c.muted }}>{sel.ar} · {sel.en} · /{sel.latin}/</T></View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          {([[t('isolated'), f.isolated], [t('formInitial'), f.initial], [t('formMedial'), f.medial], [t('formFinal'), f.final]] as const).map(([label, g]) => (
            <View key={label} style={{ alignItems: 'center' }}><Arabic size={36}>{g}</Arabic><T style={{ fontSize: 12, color: c.muted }}>{label}</T></View>
          ))}
        </View>
        {!sel.joinsNext && <T style={{ fontSize: 13 }}>{t('nonConnecting')}</T>}
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {LETTERS.map((l) => (
          <Pressable key={l.id} onPress={() => setSel(l)} accessibilityRole="button" accessibilityLabel={`${letterName(l, lang)} ${l.ar}`} accessibilityState={{ selected: sel.id === l.id }}
            style={{ width: '25%', minHeight: 64, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: sel.id === l.id ? c.accent : c.line, borderRadius: 12, backgroundColor: sel.id === l.id ? c.hl : c.surface }}>
            <Arabic size={30}>{l.ch}</Arabic>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

type Paper = 'plain' | 'lined' | 'grid';
interface Stroke { color: string; size: number; d: string; pts: [number, number][] }
const COLORS = ['#0b0b0c', '#1b6fa8', '#c0392b', '#2e8b57', '#e08a00', '#7b2cbf', '#d63384', '#6b4f2a'];

/** Free writing on paper: colours, pen size, eraser (removes the strokes you touch), undo, clear, paper types. */
function Write() {
  const { t, colors: c } = useSettings();
  const [paper, setPaper] = useState<Paper>('lined');
  const [erase, setErase] = useState(false);
  const [color, setColor] = useState(COLORS[1]!);
  const [size, setSize] = useState(5);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [history, setHistory] = useState<Stroke[][]>([]);
  const tool = useRef({ erase, color, size });
  tool.current = { erase, color, size };
  const cur = useRef<Stroke | null>(null);
  const W = 330, H = 420;

  const eraseAt = (x: number, y: number) =>
    setStrokes((all) => { const keep = all.filter((s) => !s.pts.some(([px, py]) => Math.hypot(px - x, py - y) < 16)); return keep.length === all.length ? all : keep; });

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true, onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      const { locationX: x, locationY: y } = e.nativeEvent;
      setHistory((h) => [...h, strokes]);
      if (tool.current.erase) { eraseAt(x, y); return; }
      cur.current = { color: tool.current.color, size: tool.current.size, d: `M${x.toFixed(1)},${y.toFixed(1)}`, pts: [[x, y]] };
      setStrokes((s) => [...s, cur.current!]);
    },
    onPanResponderMove: (e) => {
      const { locationX: x, locationY: y } = e.nativeEvent;
      if (tool.current.erase) { eraseAt(x, y); return; }
      const s = cur.current; if (!s) return;
      const next = { ...s, d: `${s.d} L${x.toFixed(1)},${y.toFixed(1)}`, pts: [...s.pts, [x, y] as [number, number]] };
      cur.current = next;
      setStrokes((all) => [...all.slice(0, -1), next]);
    },
    onPanResponderRelease: () => { cur.current = null; },
  }), [strokes]); // eslint-disable-line react-hooks/exhaustive-deps

  const undo = () => setHistory((h) => { const prev = h[h.length - 1]; if (prev) setStrokes(prev); return h.slice(0, -1); });
  const step = paper === 'grid' ? 30 : 42;
  const papers: [Paper, string][] = [['plain', t('paperPlain')], ['lined', t('paperLined')], ['grid', t('paperGrid')]];

  return (
    <View>
      <T style={{ color: c.muted }}>{t('pWriteDesc')}</T>
      <View style={{ width: W, height: H, alignSelf: 'center', backgroundColor: '#fffdf6', borderWidth: 2, borderColor: c.line, borderRadius: 16, overflow: 'hidden' }} {...pan.panHandlers}>
        <Svg width={W} height={H} pointerEvents="none">
          {paper !== 'plain' && Array.from({ length: Math.floor(H / step) }, (_, i) => <Line key={`h${i}`} x1={0} x2={W} y1={(i + 1) * step} y2={(i + 1) * step} stroke="#9fc6e2" strokeWidth={1} />)}
          {paper === 'grid' && Array.from({ length: Math.floor(W / step) }, (_, i) => <Line key={`v${i}`} y1={0} y2={H} x1={(i + 1) * step} x2={(i + 1) * step} stroke="#cfe3f2" strokeWidth={1} />)}
          {strokes.map((s, i) => <Path key={i} d={s.d} stroke={s.color} strokeWidth={s.size * 1.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />)}
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
        <Btn kind={!erase ? 'primary' : 'normal'} label={`✎ ${t('pen')}`} onPress={() => setErase(false)} />
        <Btn kind={erase ? 'primary' : 'normal'} label={`⌫ ${t('eraser')}`} onPress={() => setErase(true)} />
        <Btn label={`↶ ${t('undo')}`} disabled={history.length === 0} onPress={undo} />
        <Btn kind="ghost" label={t('clear')} disabled={strokes.length === 0} onPress={() => { setHistory((h) => [...h, strokes]); setStrokes([]); }} />
      </View>
      <T bold style={{ fontSize: 13, color: c.muted }}>{t('colour')}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {COLORS.map((col) => <Pressable key={col} accessibilityRole="button" accessibilityLabel={col} onPress={() => { setColor(col); setErase(false); }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: col, borderWidth: 3, borderColor: !erase && color === col ? c.accent : c.surface }} />)}
      </View>
      <T bold style={{ fontSize: 13, color: c.muted, marginTop: 8 }}>{t('penSize')}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Btn label="−" onPress={() => setSize((s) => Math.max(2, s - 1))} /><T>{size}</T><Btn label="+" onPress={() => setSize((s) => Math.min(14, s + 1))} />
      </View>
      <T bold style={{ fontSize: 13, color: c.muted }}>{t('paper')}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{papers.map(([v, l]) => <Btn key={v} kind={paper === v ? 'primary' : 'normal'} label={l} onPress={() => setPaper(v)} />)}</View>
    </View>
  );
}

/** Finger drawing. Auto-scoring needs pixel masks (web canvas); on mobile the learner self-checks against the guide. */
function Trace() {
  const { t, lang, colors: c } = useSettings();
  const [i, setI] = useState(0);
  const [paths, setPaths] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const cur = useRef('');
  const SIZE = 300;
  const letter = LETTERS[i]!;
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false, // keep the scroll view from stealing the gesture
    onPanResponderGrant: (e) => { setDone(false); cur.current = `M${e.nativeEvent.locationX.toFixed(1)},${e.nativeEvent.locationY.toFixed(1)}`; setPaths((p) => [...p, cur.current]); },
    onPanResponderMove: (e) => { cur.current += ` L${e.nativeEvent.locationX.toFixed(1)},${e.nativeEvent.locationY.toFixed(1)}`; setPaths((p) => [...p.slice(0, -1), cur.current]); },
  }), []);
  const go = (d: number) => { setI((x) => (x + d + LETTERS.length) % LETTERS.length); setPaths([]); setDone(false); };
  return (
    <View>
      <T style={{ color: c.muted }}>{t('traceHintSelf')}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Btn label={`← ${t('prev')}`} onPress={() => go(-1)} /><T bold>{letterName(letter, lang)} · {letter.ar}</T><Btn label={`${t('next')} →`} onPress={() => go(1)} />
      </View>
      <View style={{ width: SIZE, height: SIZE, alignSelf: 'center', backgroundColor: c.surface, borderWidth: 2, borderColor: c.line, borderRadius: 16 }} {...pan.panHandlers}>
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: AR, fontSize: 200, color: c.accent, opacity: 0.22 }}>{letter.ch}</Text>
        </View>
        <Svg width={SIZE} height={SIZE} pointerEvents="none">
          {paths.map((d, k) => <Path key={k} d={d} stroke={c.text} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" fill="none" />)}
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Btn label={t('clear')} onPress={() => { setPaths([]); setDone(false); }} />
        <Btn kind="primary" label={t('selfCheck')} disabled={paths.length === 0} onPress={() => setDone(true)} />
      </View>
      {done && <T accessibilityLiveRegion="polite" bold>⭐ {t('traceGood')}</T>}
    </View>
  );
}

function Quiz() {
  const { t, lang, colors: c } = useSettings();
  const [mode, setMode] = useState<QuizMode>('letter-to-name');
  const [q, setQ] = useState(() => makeQuestion('letter-to-name', lang));
  const [picked, setPicked] = useState<Letter | null>(null);
  const [score, setScore] = useState({ r: 0, n: 0 });
  const next = (m = mode) => { setQ(makeQuestion(m, lang)); setPicked(null); };
  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Btn kind={mode === 'letter-to-name' ? 'primary' : 'normal'} label={t('modeLetterName')} onPress={() => { setMode('letter-to-name'); setScore({ r: 0, n: 0 }); next('letter-to-name'); }} />
        <Btn kind={mode === 'name-to-letter' ? 'primary' : 'normal'} label={t('modeNameLetter')} onPress={() => { setMode('name-to-letter'); setScore({ r: 0, n: 0 }); next('name-to-letter'); }} />
      </View>
      <T>{t('score')}: {score.r} / {score.n}</T>
      <Card>
        {mode === 'letter-to-name' ? <Arabic size={90}>{q.target.ch}</Arabic> : <T bold style={{ fontSize: 28, textAlign: 'center' }}>{letterName(q.target, lang)}</T>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
          {q.options.map((o) => {
            const right = picked && isCorrect(q, o); const wrong = picked && picked.id === o.id && !right;
            return (
              <Pressable key={o.id} disabled={!!picked} accessibilityRole="button" accessibilityLabel={mode === 'letter-to-name' ? letterName(o, lang) : o.ar}
                onPress={() => { setPicked(o); setScore((s) => ({ r: s.r + (isCorrect(q, o) ? 1 : 0), n: s.n + 1 })); }}
                style={{ width: '46%', minHeight: 64, margin: '2%', alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 2, borderColor: right ? c.accent : wrong ? c.throat : c.line, backgroundColor: right ? c.hl : c.surface }}>
                {mode === 'letter-to-name' ? <T>{letterName(o, lang)}</T> : <Arabic size={34}>{o.ch}</Arabic>}
              </Pressable>
            );
          })}
        </View>
        {picked && <T accessibilityLiveRegion="polite" bold>{isCorrect(q, picked) ? '✅ ' + t('correct') : '❌ ' + t('wrong')}</T>}
        {picked && <Btn kind="primary" label={`${t('next')} →`} onPress={() => next()} />}
      </Card>
    </View>
  );
}

function Match() {
  const { t, lang, colors: c } = useSettings();
  const [cards, setCards] = useState(() => makeMatch(6, lang));
  const [open, setOpen] = useState<typeof cards>([]);
  const [done, setDone] = useState<string[]>([]);
  const won = done.length === cards.length / 2;
  const restart = () => { setCards(makeMatch(6, lang)); setOpen([]); setDone([]); };
  const tap = (k: (typeof cards)[number]) => {
    if (done.includes(k.pairId) || open.some((o) => o.key === k.key) || open.length === 2) return;
    const nx = [...open, k]; setOpen(nx);
    if (nx.length === 2) { if (isMatch(nx[0]!, nx[1]!)) { setDone((d) => [...d, k.pairId]); setOpen([]); } else setTimeout(() => setOpen([]), 800); }
  };
  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cards.map((k) => {
          const shown = done.includes(k.pairId) || open.some((o) => o.key === k.key);
          return (
            <Pressable key={k.key} onPress={() => tap(k)} accessibilityRole="button" accessibilityLabel={shown ? k.text : '?'}
              style={{ width: '23%', minHeight: 72, margin: '1%', alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 2, borderColor: shown ? c.accent : c.line, backgroundColor: shown ? c.hl : c.surface, opacity: done.includes(k.pairId) ? 0.55 : 1 }}>
              {shown ? (k.kind === 'letter' ? <Arabic size={32}>{k.text}</Arabic> : <T style={{ fontSize: 13, textAlign: 'center' }}>{k.text}</T>) : <T>?</T>}
            </Pressable>
          );
        })}
      </View>
      {won && <T accessibilityLiveRegion="polite" bold>🎉 {t('allMatched')}</T>}
      <Btn label={t('newRound')} onPress={restart} />
    </View>
  );
}

function Build() {
  const { t, lang, colors: c } = useSettings();
  const [wi, setWi] = useState(0);
  const word = PRACTICE_WORDS[wi]!;
  const [s, setS] = useState(() => newBuild(word));
  const go = (d: number) => { const n = (wi + d + PRACTICE_WORDS.length) % PRACTICE_WORDS.length; setWi(n); setS(newBuild(PRACTICE_WORDS[n]!)); };
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Btn label={`← ${t('prev')}`} onPress={() => go(-1)} /><T bold>{word.label[lang]}</T><Btn label={`${t('next')} →`} onPress={() => go(1)} />
      </View>
      <T style={{ color: c.muted }}>{t('buildPrompt')}</T>
      <Card>
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'center', flexWrap: 'wrap' }}>
          {s.target.map((_, k) => <View key={k} style={{ minWidth: 44, borderBottomWidth: 3, borderBottomColor: k < s.placed ? c.accent : c.line, margin: 3 }}><Arabic size={34}>{s.target[k]!.slice(0, k < s.placed ? 1 : 0) || ' '}</Arabic></View>)}
        </View>
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'center', flexWrap: 'wrap' }}>
          {s.tiles.map((tile) => (
            <Pressable key={tile.id} disabled={tile.used} onPress={() => setS((x) => tapTile(x, tile.id))} accessibilityRole="button" accessibilityLabel={tile.ch}
              style={{ minWidth: 56, minHeight: 56, margin: 4, borderRadius: 12, borderWidth: 2, borderColor: c.accent, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', opacity: tile.used ? 0.25 : 1 }}>
              <Arabic size={30}>{tile.ch}</Arabic>
            </Pressable>
          ))}
        </View>
        {isBuilt(s) && <View accessibilityLiveRegion="polite"><T bold>🎉 {t('correct')} · {t('builtJoined')}</T><Arabic size={60}>{joinedForm(word)}</Arabic><Arabic size={34}>{word.display}</Arabic></View>}
        <Btn label={t('reset')} onPress={() => setS(newBuild(word))} />
      </Card>
    </View>
  );
}

export default function Practice() {
  const { t, colors: c } = useSettings();
  const [mode, setMode] = useState<PracticeMode>('menu');
  const items: { m: Exclude<PracticeMode, 'menu'>; icon: string; title: Parameters<typeof t>[0]; desc: Parameters<typeof t>[0] }[] = [
    { m: 'chart', icon: 'ا ب ت', title: 'pChart', desc: 'pChartDesc' }, { m: 'write', icon: '✎', title: 'pWrite', desc: 'pWriteDesc' }, { m: 'trace', icon: '✍', title: 'pTrace', desc: 'pTraceDesc' },
    { m: 'quiz', icon: '؟', title: 'pQuiz', desc: 'pQuizDesc' }, { m: 'match', icon: '⇄', title: 'pMatch', desc: 'pMatchDesc' }, { m: 'build', icon: 'الله', title: 'pBuild', desc: 'pBuildDesc' },
  ];
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }} scrollEnabled={mode !== 'trace' && mode !== 'write'} keyboardShouldPersistTaps="handled">
      <T bold style={{ fontSize: 22 }}>{t('practice')}</T>
      {mode !== 'menu' && <Btn kind="ghost" label={`← ${t('practice')}`} onPress={() => setMode('menu')} />}
      {mode === 'menu' && (
        <View>
          <T style={{ color: c.muted }}>{t('practiceIntro')}</T>
          {items.map((it) => (
            <Pressable key={it.m} onPress={() => setMode(it.m)} accessibilityRole="button" accessibilityLabel={t(it.title)}>
              <Card><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Arabic size={28}>{it.icon}</Arabic><View style={{ flex: 1 }}><T bold>{t(it.title)}</T><T style={{ color: c.muted, fontSize: 13 }}>{t(it.desc)}</T></View></View></Card>
            </Pressable>
          ))}
          <T style={{ color: c.muted, fontSize: 13 }}>{t('namesReview')}</T>
        </View>
      )}
      {mode === 'chart' && <Chart />}
      {mode === 'write' && <Write />}
      {mode === 'trace' && <Trace />}
      {mode === 'quiz' && <Quiz />}
      {mode === 'match' && <Match />}
      {mode === 'build' && <Build />}
    </ScrollView>
  );
}
