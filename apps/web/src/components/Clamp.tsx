import { useState, type ReactNode } from 'react';
import { useSettings } from '../settings';

/** Long tafsir texts (some run to tens of thousands of characters) start collapsed with a Read more button. */
export function Clamp({ children, long }: { children: ReactNode; long: boolean }) {
  const { t } = useSettings();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="clamp" data-open={open || !long || undefined}>{children}</div>
      {long && <button className="btn small ghost" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? t('readLess') : t('readMore')}</button>}
    </>
  );
}
