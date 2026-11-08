// Adaptateur SqlDb sur node:sqlite, pour les tests (Vitest, CI). Pas utilisé par l'appli.
import { DatabaseSync } from 'node:sqlite';
import type { SqlDb, SqlParam } from '../types';

export function createNodeSqliteDb(path = ':memory:'): SqlDb & { close(): void } {
  const db = new DatabaseSync(path);
  let depth = 0;
  return {
    async exec(sql) {
      db.exec(sql);
    },
    async run(sql, params: SqlParam[] = []) {
      db.prepare(sql).run(...params);
    },
    async all<T>(sql: string, params: SqlParam[] = []) {
      return db.prepare(sql).all(...params) as T[];
    },
    async transaction(fn) {
      // Transactions imbriquées : seule la plus externe ouvre et valide.
      if (depth > 0) return fn();
      depth += 1;
      db.exec('begin');
      try {
        await fn();
        db.exec('commit');
      } catch (e) {
        db.exec('rollback');
        throw e;
      } finally {
        depth -= 1;
      }
    },
    close() {
      db.close();
    },
  };
}
