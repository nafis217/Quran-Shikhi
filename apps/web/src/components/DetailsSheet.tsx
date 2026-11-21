import { useEffect, useRef, useState } from 'react';
import { LANGS, pickByLang, type Lang } from '@quran-shikkha/learning-core';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useSettings } from '../settings';
import { Async } from './States';
import { TafsirText } from './TafsirText';
import { wordAudioUrl } from '../lib/audio';

interface Props { surah: number; ayah: number; onClose: () => void }

function Report({ target, id }: { target: 'tafsir' | 'translation' | 'context'; id: string }) {
  const { t } = useSettings();
  const [state, setState] = useState<'idle' | 'sent' | 'err'>('idle');
  const send = async () => {
    try {
      const r = await api.POST('/api/v1/reports', { body: { targetType: target, targetId: id, note: '' } });
      setState(r.response.ok ? 'sent' : 'err');
    } catch { setState('err'); }
  };
  return state === 'sent'
    ? <span className="notice" role="status">{t('reportSent')}</span>
    : <button className="btn ghost small" onClick={() => void send()}>⚑ {t('report')}</button>;
}

/** "Govire Jai": meaning, tafsir (in a language you choose), reason for revelation, and the full recitation. */
export function DetailsSheet({ surah, ayah, onClose }: Props) {
  const { t, lang } = useSettings();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [tLang, setTLang] = useState<Lang>(lang);
  const key = `${surah}:${ayah}`;
  const [state, retry] = useAsync(async () => {
    const r = await api.GET('/api/v1/ayahs/{surah}:{ayah}/details', { params: { path: { surah, ayah } } });
    if (!r.data) throw new Error('details');
    return r.data;
  }, [surah, ayah]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); opener?.focus?.(); };
  }, [onClose]);

  return (
    <div className="sheet-wrap">
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <aside className="sheet" role="dialog" aria-modal="true" aria-label={`${t('details')} ${key}`}>
        <header className="sheet-head">
          <h2>{t('surah')} {surah} · {t('ayah')} {ayah}</h2>
          <button ref={closeRef} className="btn ghost" onClick={onClose} aria-label={t('close')}>✕</button>
        </header>
        <Async state={state} retry={retry}>
          {(d) => {
            const meaning = pickByLang(lang, d.translationBn, d.translationEn);
            const tafsir = tLang === 'bn' ? d.tafsirBn : tLang === 'en' ? d.tafsirEn : d.tafsirAr;
            const audio = wordAudioUrl(d.audioUrl);
            return (
              <div>
                <section>
                  <h3>{t('translation')}</h3>
                  {meaning ? (
                    <>
                      <p className="trans" lang={meaning === d.translationBn ? 'bn' : 'en'}>{meaning.text}</p>
                      <p className="src">{t('source')}: {meaning.source}{meaning.version ? ` · ${t('version')} ${meaning.version}` : ''}</p>
                      <Report target="translation" id={key} />
                    </>
                  ) : <p className="state">{t('empty')}</p>}
                </section>

                <section>
                  <h3>{t('tafsir')}</h3>
                  <div className="seg" role="group" aria-label={t('tafsirLang')}>
                    {LANGS.map((l) => <button key={l.code} aria-pressed={tLang === l.code} onClick={() => setTLang(l.code)}>{l.label}</button>)}
                  </div>
                  {tafsir ? (
                    <>
                      {tafsir.hasPlaceholder && <p className="notice warn" role="note">{t('placeholderWarn')}</p>}
                      <TafsirText text={tafsir.text} lang={tLang} />
                      <p className="src">{t('source')}: {tafsir.name}{tafsir.attribution ? ` · ${tafsir.attribution}` : ''}</p>
                      <Report target="tafsir" id={`${key}#${tLang}`} />
                    </>
                  ) : <p className="state">{t('noTafsirLang')}</p>}
                </section>

                <section>
                  <h3>{t('revelation')}</h3>
                  {d.revelation ? (
                    <>
                      <TafsirText text={d.revelation.text} lang="en" />
                      <p className="src">{t('source')}: {d.revelation.name}. {t('revelationNote')}</p>
                    </>
                  ) : <p className="meta">{t('noRevelation')}</p>}
                  {d.context && (
                    <div className="context-card">
                      <h3>{t('context')}</h3>
                      <p lang="bn">{d.context.textBn}</p>
                      {d.context.textEn && <p lang="en" className="secondary">{d.context.textEn}</p>}
                      <p className="src">{t('source')}: {d.context.source}</p>
                      <Report target="context" id={key} />
                    </div>
                  )}
                </section>

                <section>
                  <h3>{t('recitation')}</h3>
                  {audio ? (
                    <>
                      <audio controls preload="none" src={audio} aria-label={t('recitation')} />
                      {d.reciter && <p className="src">{t('reciter')}: {d.reciter}</p>}
                    </>
                  ) : <p className="state">{t('noAudio')}</p>}
                </section>
              </div>
            );
          }}
        </Async>
      </aside>
    </div>
  );
}
