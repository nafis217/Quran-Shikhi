import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import {
  CATEGORIES, VOCAB, categoryName, isBuilt, isVocabMatch, makeVocabMatch, makeVocabQuestion, meaningOf, newBuild, optionLabel, tapTile, toBuildWord, wordOfTheDay, wordsOf,
  type CategoryId, type VocabCard, type VocabQuestion, type VocabQuizKind, type VocabWord,
} from '@quran-shikkha/learning-core';
import { api, authed } from '../api';
import { speakArabic } from '../speech';
import { useSettings } from '../settings';
import { vocabPron } from '../vocabPron';
import { Btn, Card, T } from '../components/Ui';
import type { Nav } from '../nav';

const AR = 'AmiriQuran_400Regular';

function WordCard({ w, big }: { w: VocabWord; big?: boolean }) {
  const { t, lang, showPron, colors: c } = useSettings();
  const [msg, setMsg] = useState('');
  const [added, setAdded] = useState(false);
  return (
    <Card>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: big ? 72 : 52 }} accessibilityLabel={w.en}>{w.emoji}</Text>
        <Text style={{ fontFamily: AR, fontSize: big ? 44 : 34, lineHeight: big ? 90 : 70, color: c.text }}>{w.ar}</Text>
        {showPron && <T style={{ color: c.muted, fontSize: 14 }}>{vocabPron(w, lang)}</T>}
        <T bold>{meaningOf(w, lang)}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Btn label={`🔊 ${t('speak')}`} onPress={() => void speakArabic(w.ar).then((ok) => setMsg(ok ? '' : t('noVoice')))} />
          <Btn kind="ghost" label={added ? `✓ ${t('cardAdded')}` : `＋ ${t('addCard')}`} disabled={added}
            onPress={() => void authed(() => api.POST('/api/v1/flashcards', { body: { wordKey: `v:${w.id}` } })).then((r) => r.response.ok && setAdded(true), () => setMsg(t('errorBody')))} />
        </View>
        {!!msg && <T style={{ fontSize: 13 }} accessibilityLiveRegion="polite">{msg}</T>}
      </View>
    </Card>
  );
}

function Face({ kind, w }: { kind: VocabQuizKind; w: VocabWord }) {
  const { lang, colors: c } = useSettings();
  if (kind === 'word-to-picture' || kind === 'listen-to-picture') return <Text style={{ fontSize: 40 }} accessibilityLabel={w.en}>{w.emoji}</Text>;
  if (kind === 'word-to-meaning') return <T style={{ textAlign: 'center' }}>{meaningOf(w, lang)}</T>;
  return <Text style={{ fontFamily: AR, fontSize: 30, color: c.text }}>{w.ar}</Text>;
}

function Quiz({ pool, kinds }: { pool: VocabWord[]; kinds: VocabQuizKind[] }) {
  const { t, lang, colors: c } = useSettings();
  const make = () => makeVocabQuestion(kinds[Math.floor(Math.random() * kinds.length)]!, pool, lang);
  const [q, setQ] = useState<VocabQuestion>(make);
  const [picked, setPicked] = useState<VocabWord | null>(null);
  const [score, setScore] = useState({ r: 0, n: 0 });
  useEffect(() => { if (q.kind === 'listen-to-picture') void speakArabic(q.target.ar); }, [q]);
  return (
    <Card>
      <T style={{ color: c.muted }}>{t('score')}: {score.r} / {score.n}</T>
      <View style={{ alignItems: 'center' }}>
        {q.kind === 'picture-to-word' && <Text style={{ fontSize: 90 }} accessibilityLabel={q.target.en}>{q.target.emoji}</Text>}
        {q.kind === 'listen-to-picture' && <Btn label={`🔊 ${t('speak')}`} onPress={() => void speakArabic(q.target.ar)} />}
        {(q.kind === 'word-to-picture' || q.kind === 'word-to-meaning') && <Text style={{ fontFamily: AR, fontSize: 56, lineHeight: 110, color: c.text }}>{q.target.ar}</Text>}
        {q.kind === 'meaning-to-word' && <T bold style={{ fontSize: 26, textAlign: 'center' }}>{meaningOf(q.target, lang)}</T>}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
        {q.options.map((o) => {
          const right = o.id === q.target.id;
          return (
            <Pressable key={o.id} disabled={!!picked} accessibilityRole="button" accessibilityLabel={optionLabel(q.kind, o, lang)}
              onPress={() => { setPicked(o); setScore((s) => ({ r: s.r + (right ? 1 : 0), n: s.n + 1 })); }}
              style={{ width: '46%', minHeight: 72, margin: '2%', alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 2, padding: 6,
                borderColor: picked ? (right ? c.accent : picked.id === o.id ? c.throat : c.line) : c.line, backgroundColor: picked && right ? c.hl : c.surface }}>
              <Face kind={q.kind} w={o} />
            </Pressable>
          );
        })}
      </View>
      {picked && <T bold accessibilityLiveRegion="polite">{picked.id === q.target.id ? `✅ ${t('correct')}` : `❌ ${t('wrong')} — ${q.target.ar} · ${meaningOf(q.target, lang)}`}</T>}
      {picked && <Btn kind="primary" label={`${t('next')} →`} onPress={() => { setQ(make()); setPicked(null); }} />}
    </Card>
  );
}

function Match({ pool }: { pool: VocabWord[] }) {
  const { t, age, colors: c } = useSettings();
  const pairs = Math.min(age === 'kids' ? 6 : 8, pool.filter((w) => w.visual).length);
  const [cards, setCards] = useState<VocabCard[]>(() => makeVocabMatch(pairs, pool));
  const [open, setOpen] = useState<VocabCard[]>([]);
  const [done, setDone] = useState<string[]>([]);
  const won = cards.length > 0 && done.length === cards.length / 2;
  const tap = (k: VocabCard) => {
    if (done.includes(k.pairId) || open.some((o) => o.key === k.key) || open.length === 2) return;
    if (k.kind === 'word') void speakArabic(k.text);
    const nx = [...open, k]; setOpen(nx);
    if (nx.length === 2) { if (isVocabMatch(nx[0]!, nx[1]!)) { setDone((d) => [...d, k.pairId]); setOpen([]); } else setTimeout(() => setOpen([]), 900); }
  };
  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cards.map((k) => {
          const shown = done.includes(k.pairId) || open.some((o) => o.key === k.key);
          return (
            <Pressable key={k.key} onPress={() => tap(k)} accessibilityRole="button" accessibilityLabel={shown ? k.text : '?'}
              style={{ width: '23%', minHeight: 76, margin: '1%', alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 2, borderColor: shown ? c.accent : c.line, backgroundColor: shown ? c.hl : c.surface, opacity: done.includes(k.pairId) ? 0.55 : 1 }}>
              {shown ? (k.kind === 'picture' ? <Text style={{ fontSize: 34 }}>{k.text}</Text> : <Text style={{ fontFamily: AR, fontSize: 24, color: c.text }}>{k.text}</Text>) : <T>?</T>}
            </Pressable>
          );
        })}
      </View>
      {won && <T bold accessibilityLiveRegion="polite">🎉 {t('allMatched')}</T>}
      <Btn label={t('newRound')} onPress={() => { setCards(makeVocabMatch(pairs, pool)); setOpen([]); setDone([]); }} />
    </View>
  );
}

function Spell({ pool }: { pool: VocabWord[] }) {
  const { t, lang, colors: c } = useSettings();
  const pick = () => pool[Math.floor(Math.random() * pool.length)]!;
  const [word, setWord] = useState<VocabWord>(pick);
  const [state, setState] = useState(() => newBuild(toBuildWord(word)));
  const [nudge, setNudge] = useState(false);
  const done = isBuilt(state);
  const spoke = useRef('');
  useEffect(() => { if (done && spoke.current !== word.id) { spoke.current = word.id; void speakArabic(word.ar); } }, [done, word]);
  return (
    <Card>
      <View style={{ alignItems: 'center' }}>
        {word.visual && <Text style={{ fontSize: 64 }} accessibilityLabel={word.en}>{word.emoji}</Text>}
        <T bold>{meaningOf(word, lang)}</T>
      </View>
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'center', flexWrap: 'wrap' }}>
        {state.target.map((_, k) => <View key={k} style={{ minWidth: 40, borderBottomWidth: 3, borderBottomColor: k < state.placed ? c.accent : c.line, margin: 3 }}><Text style={{ fontFamily: AR, fontSize: 32, color: c.text, textAlign: 'center' }}>{k < state.placed ? state.target[k] : ' '}</Text></View>)}
      </View>
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'center', flexWrap: 'wrap' }}>
        {state.tiles.map((tile) => (
          <Pressable key={tile.id} disabled={tile.used} accessibilityRole="button" accessibilityLabel={tile.ch}
            onPress={() => setState((s) => { const n = tapTile(s, tile.id); setNudge(n.mistakes > s.mistakes); return n; })}
            style={{ minWidth: 54, minHeight: 54, margin: 4, borderRadius: 12, borderWidth: 2, borderColor: c.accent, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', opacity: tile.used ? 0.25 : 1 }}>
            <Text style={{ fontFamily: AR, fontSize: 30, color: c.text }}>{tile.ch}</Text>
          </Pressable>
        ))}
      </View>
      {nudge && !done && <T accessibilityLiveRegion="polite">↺ {t('wrong')}</T>}
      {done && <T bold accessibilityLiveRegion="polite">🎉 {t('correct')} · {word.ar}</T>}
      <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
        <Btn label={t('reset')} onPress={() => { setState(newBuild(toBuildWord(word))); setNudge(false); }} />
        <Btn kind="primary" label={`${t('next')} →`} onPress={() => { const w = pick(); setWord(w); setState(newBuild(toBuildWord(w))); setNudge(false); }} />
      </View>
    </Card>
  );
}

type Game = 'picture' | 'listen' | 'match' | 'spell' | 'meaning';

export default function Learn({ cat, open }: { cat?: string; open: (s: Nav) => void }) {
  const { t, lang, age, colors: c } = useSettings();
  const [game, setGame] = useState<Game | null>(null);
  const pool = useMemo<VocabWord[]>(() => (cat ? wordsOf(cat as CategoryId) : [...VOCAB]), [cat]);
  const hasPictures = pool.some((w) => w.visual);
  const games: [Game, string, string][] = [['picture', '🖼️', t('gPicture')], ['listen', '👂', t('gListen')], ['match', '🃏', t('gMatch')], ['spell', '🔤', t('gSpell')], ['meaning', '❓', t('gMeaning')]];
  const usable = games.filter(([g]) => hasPictures || g === 'spell' || g === 'meaning');

  const gameView = game && (
    game === 'picture' ? <Quiz key="p" pool={pool} kinds={['picture-to-word', 'word-to-picture']} />
    : game === 'listen' ? <Quiz key="l" pool={pool} kinds={['listen-to-picture']} />
    : game === 'meaning' ? <Quiz key="m" pool={pool} kinds={['word-to-meaning', 'meaning-to-word']} />
    : game === 'match' ? <Match pool={pool} /> : <Spell pool={pool} />
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 90 }}>
      <T bold style={{ fontSize: 22 }}>{cat ? `${CATEGORIES.find((x) => x.id === cat)?.emoji ?? ''} ${categoryName(cat as CategoryId, lang)}` : t('dailyArabic')}</T>
      {!cat && <T style={{ color: c.muted }}>{t('dailyIntro')} · {VOCAB.length} {t('wordsCount2')}</T>}
      {!cat && <><T bold style={{ marginTop: 8 }}>{t('wordOfDay')}</T><WordCard w={wordOfTheDay()} big /></>}

      <T bold style={{ marginTop: 8, fontSize: 18 }}>{t('games')}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {usable.filter(([g]) => age === 'kids' ? g !== 'meaning' || !!cat : true).map(([g, icon, label]) => <Btn key={g} kind={game === g ? 'primary' : 'normal'} label={`${icon} ${label}`} onPress={() => setGame(game === g ? null : g)} />)}
      </View>
      {gameView}

      {!cat && (
        <>
          <T bold style={{ marginTop: 8, fontSize: 18 }}>{t('categories')}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {CATEGORIES.map((x) => (
              <Pressable key={x.id} accessibilityRole="button" accessibilityLabel={categoryName(x.id, lang)} onPress={() => open({ name: 'learn', cat: x.id })}
                style={{ width: '31%', margin: '1%', minHeight: 96, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, padding: 6 }}>
                <Text style={{ fontSize: 34 }}>{x.emoji}</Text>
                <T bold style={{ fontSize: 13, textAlign: 'center' }}>{categoryName(x.id, lang)}</T>
                <T style={{ fontSize: 11, color: c.muted }}>{wordsOf(x.id).length}</T>
              </Pressable>
            ))}
          </View>
          <Btn kind="ghost" label={`📺 ${t('watchRead')}`} onPress={() => open({ name: 'watch' })} />
        </>
      )}
      {cat && pool.map((w) => <WordCard key={w.id} w={w} />)}
      <T style={{ color: c.muted, fontSize: 12 }}>{t('voiceNote')}</T>
    </ScrollView>
  );
}
