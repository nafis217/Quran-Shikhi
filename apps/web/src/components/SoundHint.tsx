import { useEffect, useState } from 'react';
import { useSettings } from '../settings';

/** Browsers block audio until the page has been clicked once. Shown only when a play attempt was actually blocked. */
export function SoundHint() {
  const { t } = useSettings();
  const [show, setShow] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const on = () => { setShow(true); clearTimeout(timer); timer = setTimeout(() => setShow(false), 7000); };
    const off = () => setShow(false);
    window.addEventListener('qs:audio-blocked', on);
    window.addEventListener('pointerdown', off);
    return () => { window.removeEventListener('qs:audio-blocked', on); window.removeEventListener('pointerdown', off); clearTimeout(timer); };
  }, []);
  return show ? <p className="toast" role="status">{t('soundHint')}</p> : null;
}
