import { DRAFT_CARDS, FAMILIAR, lessonSeeds } from './lessons.ts';

const SCHEMA_VERSION = '1';
const DDL = [
  `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS content (kind TEXT NOT NULL, surah INTEGER NOT NULL, ayah INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY (kind, surah, ayah)) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS lessons (id INTEGER PRIMARY KEY, ord INTEGER NOT NULL, title TEXT NOT NULL, title_en TEXT NOT NULL, type TEXT NOT NULL, ayah_range TEXT)`,
  `CREATE TABLE IF NOT EXISTS lesson_items (id INTEGER PRIMARY KEY AUTOINCREMENT, lesson_id INTEGER NOT NULL, arabic_match TEXT, note TEXT, ord INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, is_guest INTEGER NOT NULL, email TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS user_progress (user_id TEXT NOT NULL, lesson_id INTEGER NOT NULL, completed_items INTEGER NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, lesson_id))`,
  `CREATE TABLE IF NOT EXISTS flashcards (user_id TEXT NOT NULL, word_key TEXT NOT NULL, ease REAL NOT NULL, interval_days INTEGER NOT NULL, repetitions INTEGER NOT NULL, due_at TEXT NOT NULL, PRIMARY KEY (user_id, word_key))`,
  `CREATE INDEX IF NOT EXISTS ix_flash_due ON flashcards (user_id, due_at)`,
  `CREATE TABLE IF NOT EXISTS context_cards (id INTEGER PRIMARY KEY AUTOINCREMENT, ayah_key TEXT NOT NULL, ayah_end_key TEXT, source TEXT NOT NULL, text_bn TEXT NOT NULL, text_en TEXT, review_status INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS content_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, target_type TEXT NOT NULL, target_id TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL)`,
];

let ready: Promise<void> | null = null;

/** Creates the tables and our own lesson list on first use. Cheap afterwards (one small query per cold start). */
export function ensureSchema(db: D1Database): Promise<void> {
  return (ready ??= (async () => {
    try {
      const row = await db.prepare(`SELECT value FROM meta WHERE key = 'schema'`).first<{ value: string }>();
      if (row?.value === SCHEMA_VERSION) return;
    } catch { /* table does not exist yet */ }
    await db.batch(DDL.map((s) => db.prepare(s)));
    const stmts: D1PreparedStatement[] = [];
    for (const [i, l] of lessonSeeds().entries()) stmts.push(db.prepare(`INSERT OR IGNORE INTO lessons (id, ord, title, title_en, type, ayah_range) VALUES (?,?,?,?,?,?)`).bind(i + 1, l.order, l.title, l.titleEn, l.type, l.ayahRange));
    const familiarId = lessonSeeds().findIndex((l) => l.type === 'familiar') + 1;
    const has = await db.prepare(`SELECT COUNT(*) AS n FROM lesson_items`).first<{ n: number }>();
    if (!has || has.n === 0) for (const [i, f] of FAMILIAR.entries()) stmts.push(db.prepare(`INSERT INTO lesson_items (lesson_id, arabic_match, note, ord) VALUES (?,?,?,?)`).bind(familiarId, f.arabicMatch, `${f.labelBn}|${f.labelEn}`, i + 1));
    const cards = await db.prepare(`SELECT COUNT(*) AS n FROM context_cards`).first<{ n: number }>();
    if (!cards || cards.n === 0) for (const c of DRAFT_CARDS) stmts.push(db.prepare(`INSERT INTO context_cards (ayah_key, ayah_end_key, source, text_bn, text_en, review_status) VALUES (?,?,?,?,NULL,0)`).bind(c.ayahKey, c.ayahEndKey, c.source, c.textBn));
    stmts.push(db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema', ?)`).bind(SCHEMA_VERSION));
    await db.batch(stmts);
  })().catch((e) => { ready = null; throw e; }));
}

export const resetSchemaCache = () => { ready = null; };

export async function getMeta(db: D1Database, key: string): Promise<string | null> {
  return (await db.prepare(`SELECT value FROM meta WHERE key = ?`).bind(key).first<{ value: string }>())?.value ?? null;
}
