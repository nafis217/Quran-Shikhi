import { handle } from 'hono/cloudflare-pages';
import { app } from '../../apps/edge/src/app.ts';

/** Cloudflare Pages Function: serves /api/* from the same address as the website (no CORS needed). */
export const onRequest = handle(app);
