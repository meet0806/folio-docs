import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import pg from 'pg';

export const schema = [
  'CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, owner TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)',
  "CREATE TABLE IF NOT EXISTS shares (document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE, user_id TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('editor','viewer')), PRIMARY KEY(document_id, user_id))",
  'CREATE INDEX IF NOT EXISTS documents_owner ON documents(owner)',
  'CREATE INDEX IF NOT EXISTS shares_user ON shares(user_id)',
];
export function createSqlite(filename = ':memory:') {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const raw = new DatabaseSync(filename);
  raw.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  schema.forEach(sql => raw.exec(sql));
  return {
    prepare(sql) { const statement = raw.prepare(sql); return { bind(...args) { return {
      first: async () => statement.get(...args) || null,
      all: async () => ({ results: statement.all(...args) }),
      run: async () => ({ meta: { changes: Number(statement.run(...args).changes) } }),
    }; } }; },
    async batch(statements) {
      raw.exec('BEGIN');
      try { const r = []; for (const s of statements) r.push(await s.run()); raw.exec('COMMIT'); return r; }
      catch (e) { raw.exec('ROLLBACK'); throw e; }
    },
    close: async () => raw.close(),
  };
}
export function postgresSql(sql) {
  let index = 0;
  const ignored = sql.startsWith('INSERT OR IGNORE');
  return sql.replace('INSERT OR IGNORE', 'INSERT').replace(/\?/g, () => `$${++index}`) + (ignored ? ' ON CONFLICT DO NOTHING' : '');
}
export async function createPostgres(connectionString) {
  const pool = new pg.Pool({ connectionString, max: 5 });
  for (const sql of schema) await pool.query(sql);
  return {
    prepare(sql) { return { bind(...args) { return {
      first: async () => (await pool.query(postgresSql(sql), args)).rows[0] || null,
      all: async () => ({ results: (await pool.query(postgresSql(sql), args)).rows }),
      run: async () => ({ meta: { changes: (await pool.query(postgresSql(sql), args)).rowCount } }),
      sql: postgresSql(sql), args,
    }; } }; },
    async batch(statements) {
      const client = await pool.connect();
      try { await client.query('BEGIN'); const r = []; for (const s of statements) r.push(await client.query(s.sql, s.args)); await client.query('COMMIT'); return r; }
      catch (e) { await client.query('ROLLBACK'); throw e; }
      finally { client.release(); }
    },
    close: () => pool.end(),
  };
}
