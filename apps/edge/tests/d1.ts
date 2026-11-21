import { createRequire } from 'node:module';

// vite does not know the newer built-in 'node:sqlite', so load it the plain Node way
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as { DatabaseSync: new (path: string) => { prepare: (sql: string) => { get: (...a: unknown[]) => unknown; all: (...a: unknown[]) => unknown[]; run: (...a: unknown[]) => { changes: number | bigint } }; exec: (sql: string) => void } };

/** A tiny stand-in for Cloudflare D1 on top of Node's built-in SQLite, so the API can be tested without Cloudflare. */
export function fakeD1(path = ':memory:'): D1Database {
  const db = new DatabaseSync(path);
  const stmt = (sql: string, args: unknown[] = []) => {
    const s: Record<string, unknown> = {
      bind: (...a: unknown[]) => stmt(sql, a),
      first: async (col?: string) => { const r = db.prepare(sql).get(...(args as never[])) as Record<string, unknown> | undefined; return r === undefined ? null : col ? r[col] : r; },
      all: async () => ({ results: db.prepare(sql).all(...(args as never[])), success: true, meta: {} }),
      run: async () => { const r = db.prepare(sql).run(...(args as never[])); return { results: [], success: true, meta: { changes: Number(r.changes) } }; },
      raw: async () => db.prepare(sql).all(...(args as never[])).map((r) => Object.values(r as object)),
    };
    return s;
  };
  const d1 = {
    prepare: (sql: string) => stmt(sql),
    batch: async (list: { all: () => Promise<unknown>; run: () => Promise<unknown> }[]) => {
      const out: unknown[] = [];
      db.exec('BEGIN');
      try { for (const s of list) out.push(await s.all()); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
      return out;
    },
    exec: async (sql: string) => { db.exec(sql); return { count: 1, duration: 0 }; },
  };
  return d1 as unknown as D1Database;
}
