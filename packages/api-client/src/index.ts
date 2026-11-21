import createClient, { type Middleware } from 'openapi-fetch';
import type { components, paths } from './schema';

export type { paths, components };
export type Ayah = components['schemas']['AyahDto'];
export type Word = components['schemas']['WordDto'];
export type AyahDetails = components['schemas']['AyahDetailsDto'];
export type Chapter = components['schemas']['ChapterDto'];
export type FrequencyTrack = components['schemas']['FrequencyTrackDto'];

export interface ApiOptions {
  baseUrl: string;
  /** Returns the bearer token (guest or account), if any. */
  getToken?: () => string | null | Promise<string | null>;
}

/** Typed client. Generated from the backend OpenAPI document (`pnpm generate`). Talks ONLY to our backend. */
export function createApi({ baseUrl, getToken }: ApiOptions) {
  const client = createClient<paths>({ baseUrl });
  const auth: Middleware = {
    async onRequest({ request }) {
      const t = await getToken?.();
      if (t) request.headers.set('Authorization', `Bearer ${t}`);
      return request;
    },
  };
  client.use(auth);
  return client;
}
export type Api = ReturnType<typeof createApi>;
