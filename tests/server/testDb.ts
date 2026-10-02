import { readFileSync, readdirSync } from 'node:fs';
import initSqlJs, { type Database } from 'sql.js';
import type { Db, DbStatement } from '../../server/db';

const MIGRATIONS = new URL('../../migrations/', import.meta.url);

/** An in-memory SQLite database with all migrations applied, behind the same API as Cloudflare D1. */
export async function createTestDb(): Promise<Db & { raw: Database }> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  raw.run('PRAGMA foreign_keys = ON');
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    raw.run(readFileSync(new URL(file, MIGRATIONS), 'utf8'));
  }

  const query = (sql: string, params: unknown[]) => {
    const stmt = raw.prepare(sql);
    stmt.bind(params.map((v) => (v === undefined ? null : v)) as never);
    const rows: Record<string, unknown>[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  };

  const prepare = (sql: string): DbStatement => {
    let params: unknown[] = [];
    const statement: DbStatement = {
      bind: (...values) => {
        params = values;
        return statement;
      },
      first: async <T,>() => (query(sql, params)[0] as T) ?? null,
      all: async <T,>() => ({ results: query(sql, params) as T[] }),
      run: async () => {
        query(sql, params);
        return { meta: { changes: raw.getRowsModified() } };
      },
    };
    return statement;
  };

  return {
    raw,
    prepare,
    batch: async (statements) => {
      raw.run('BEGIN');
      try {
        const out = [];
        for (const s of statements) out.push(await s.run());
        raw.run('COMMIT');
        return out;
      } catch (e) {
        raw.run('ROLLBACK');
        throw e;
      }
    },
  };
}
