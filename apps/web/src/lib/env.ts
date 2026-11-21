/**
 * Where the API lives. Published site: the same address as the website (the backend runs beside it on Cloudflare).
 * Local development: the backend on port 5038 (C#), or set VITE_API_URL (e.g. http://127.0.0.1:8788 for the TypeScript one).
 */
const configured = import.meta.env['VITE_API_URL'] as string | undefined;
export const API_URL = configured ?? (import.meta.env.PROD ? window.location.origin : 'http://localhost:5038');
export const AUDIO_BASE = (import.meta.env['VITE_AUDIO_BASE'] as string | undefined) ?? 'https://audio.qurancdn.com/';
