import type { ReactNode } from 'react';
import type { AsyncState } from '../lib/useAsync';
import { useSettings } from '../settings';

export function Loading() {
  const { t } = useSettings();
  return <p className="state" role="status">{t('loading')}</p>;
}
function ErrorState({ retry }: { retry: () => void }) {
  const { t } = useSettings();
  return (
    <div className="state" role="alert">
      <h2>{t('errorTitle')}</h2>
      <p>{t('errorBody')}</p>
      <button className="btn" onClick={retry}>{t('retry')}</button>
    </div>
  );
}
export function Empty({ children }: { children?: ReactNode }) {
  const { t } = useSettings();
  return <p className="state">{children ?? t('empty')}</p>;
}
export function Async<T>({ state, retry, children }: { state: AsyncState<T>; retry: () => void; children: (d: T) => ReactNode }) {
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorState retry={retry} />;
  return <>{children(state.data)}</>;
}
