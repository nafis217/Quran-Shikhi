import { createApi } from '@quran-shikkha/api-client';
import { API_URL } from './env';
import { getSecret, setSecret } from './storage';

let token: string | null = null;
let pending: Promise<void> | null = null;

/** Guest session, created lazily. The app never needs an account. Talks ONLY to our backend. */
export function ensureSession(): Promise<void> {
  if (token) return Promise.resolve();
  pending ??= (async () => {
    token = await getSecret('qs.token');
    if (!token) {
      const r = await fetch(`${API_URL}/api/v1/auth/guest`, { method: 'POST' });
      if (!r.ok) throw new Error('guest');
      token = ((await r.json()) as { token: string }).token;
      await setSecret('qs.token', token);
    }
  })().finally(() => { pending = null; });
  return pending;
}

export const api = createApi({ baseUrl: API_URL, getToken: () => token });
export async function authed<T>(fn: () => Promise<T>): Promise<T> { await ensureSession(); return fn(); }
