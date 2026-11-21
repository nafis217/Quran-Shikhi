import { useEffect, useState } from 'react';
import { BackHandler, SafeAreaView, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts, NotoSansBengali_400Regular, NotoSansBengali_700Bold } from '@expo-google-fonts/noto-sans-bengali';
import { AmiriQuran_400Regular } from '@expo-google-fonts/amiri-quran';
import { dirOf } from '@quran-shikkha/learning-core';
import { SettingsProvider, useSettings } from './settings';
import { Btn, T } from './components/Ui';
import { SettingsSheet } from './components/SettingsSheet';
import type { Nav } from './nav';
import Home from './screens/Home';
import Reader from './screens/Reader';
import TafsirScreen from './screens/TafsirScreen';
import Frequent from './screens/Frequent';
import Flashcards from './screens/Flashcards';
import Credits from './screens/Credits';
import Familiar from './screens/Familiar';
import Practice from './screens/Practice';
import Learn from './screens/Learn';
import PlanScreen from './screens/PlanScreen';
import { hydrate } from './readingStore';
import Watch from './screens/Watch';

function Shell() {
  const { t, lang, colors: c } = useSettings();
  const [stack, setStack] = useState<Nav[]>([{ name: 'home' }]);
  const screen = stack[stack.length - 1]!;
  const push = (s: Nav) => setStack((o) => [...o, s]);
  const goTab = (s: Nav) => setStack([{ name: 'home' }, ...(s.name === 'home' ? [] : [s])]);

  useEffect(() => { void hydrate(); }, []);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (stack.length > 1) { setStack((o) => o.slice(0, -1)); return true; } return false; });
    return () => sub.remove();
  }, [stack.length]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, direction: dirOf(lang) }}>
      <StatusBar style="auto" />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.line }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {stack.length > 1 && <Btn kind="ghost" label="←" a11y={t('close')} onPress={() => setStack((o) => o.slice(0, -1))} />}
          <T bold style={{ color: c.accent, fontSize: 18 }}>{t('appName')}</T>
        </View>
        <SettingsSheet />
      </View>
      <View style={{ flex: 1 }}>
        {screen.name === 'home' && <Home open={push} />}
        {screen.name === 'reader' && <Reader key={`${screen.surah}-${screen.from ?? 0}`} surah={screen.surah} from={screen.from} open={push} />}
        {screen.name === 'tafsir' && <TafsirScreen surah={screen.surah} />}
        {screen.name === 'frequent' && <Frequent />}
        {screen.name === 'familiar' && <Familiar id={screen.id} />}
        {screen.name === 'flashcards' && <Flashcards />}
        {screen.name === 'credits' && <Credits />}
        {screen.name === 'practice' && <Practice />}
        {screen.name === 'learn' && <Learn key={screen.cat ?? 'all'} cat={screen.cat} open={push} />}
        {screen.name === 'watch' && <Watch />}
        {screen.name === 'plan' && <PlanScreen open={push} />}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.line }}>
        <Btn kind="ghost" label={t('home')} onPress={() => goTab({ name: 'home' })} />
        <Btn kind="ghost" label={t('myPlan')} onPress={() => goTab({ name: 'plan' })} />
        <Btn kind="ghost" label={t('dailyArabic')} onPress={() => goTab({ name: 'learn' })} />
        <Btn kind="ghost" label={t('practice')} onPress={() => goTab({ name: 'practice' })} />
        <Btn kind="ghost" label={t('flashcards')} onPress={() => goTab({ name: 'flashcards' })} />
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  const [loaded] = useFonts({ NotoSansBengali_400Regular, NotoSansBengali_700Bold, AmiriQuran_400Regular });
  if (!loaded) return null;
  return <SettingsProvider><Shell /></SettingsProvider>;
}
