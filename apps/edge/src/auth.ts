/** Minimal HS256 JWT with WebCrypto. Tokens carry the user id (sub) and a guest flag, valid 60 days. */
const enc = new TextEncoder();
const ISS = 'quran-shikkha', AUD = 'quran-shikkha-clients', DAYS = 60;

const b64url = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ''; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
};
const fromB64url = (s: string): Uint8Array<ArrayBuffer> => {
  const b = atob(s.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(s.length / 4) * 4, '='));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
const hmacKey = (secret: string, usage: KeyUsage) => crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);

export async function signToken(secret: string, userId: string, isGuest: boolean, now = Date.now()): Promise<string> {
  const head = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = b64url(enc.encode(JSON.stringify({ sub: userId, guest: isGuest ? '1' : '0', iss: ISS, aud: AUD, exp: Math.floor(now / 1000) + DAYS * 86400 })));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), enc.encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}

/** Returns the user id when the token is genuine, unexpired and meant for us; otherwise null. */
export async function verifyToken(secret: string, token: string, now = Date.now()): Promise<string | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret, 'verify'), fromB64url(parts[2]!), enc.encode(`${parts[0]}.${parts[1]}`));
    if (!ok) return null;
    const head = JSON.parse(new TextDecoder().decode(fromB64url(parts[0]!))) as { alg?: string };
    if (head.alg !== 'HS256') return null;
    const p = JSON.parse(new TextDecoder().decode(fromB64url(parts[1]!))) as { sub?: string; iss?: string; aud?: string; exp?: number };
    if (p.iss !== ISS || p.aud !== AUD || typeof p.exp !== 'number' || p.exp * 1000 < now) return null;
    return typeof p.sub === 'string' && /^[0-9a-f-]{36}$/i.test(p.sub) ? p.sub : null;
  } catch { return null; }
}

export const randomHex = (bytes: number): string => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function sha256Hex(s: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
