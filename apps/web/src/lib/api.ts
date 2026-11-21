import { createApi } from '@quran-shikkha/api-client';
import { API_URL } from './env';
import { load, save } from './storage';

interface Session { token: string; userId: string; isGuest: boolean; email?: string | null }
let session: Session | null = load<Session | null>('qs.session', null);
let pending: Promise<Session> | null = null;

/** The app works with no account: a guest session is created lazily the first time user data is needed. */
async function ensureSession(): Promise<Session> {
  if (session) return session;
  pending ??= fetch(`${API_URL}/api/v1/auth/guest`, { method: 'POST' })
    .then((r) => { if (!r.ok) throw new Error('guest'); return r.json() as Promise<{ token: string; userId: string; isGuest: boolean }>; })
    .then((j) => { session = { token: j.token, userId: j.userId, isGuest: j.isGuest }; save('qs.session', session); return session; })
    .finally(() => { pending = null; });
  return pending;
}

export const api = createApi({ baseUrl: API_URL, getToken: () => session?.token ?? null });

/** Call before any user-data request. */
export async function authed<T>(fn: () => Promise<T>): Promise<T> {
  await ensureSession();
  return fn();
}
