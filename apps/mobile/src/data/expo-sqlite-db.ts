import type { SqlDb, SqlParam } from '@preuvio/shared';
import * as SQLite from 'expo-sqlite';

/** Base locale du téléphone (expo-sqlite), au format attendu par le moteur de synchronisation. */
export async function openLocalDb(name = 'preuvio.db'): Promise<SqlDb> {
  const db = await SQLite.openDatabaseAsync(name);
  await db.execAsync('pragma journal_mode = wal;');
  let depth = 0;
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params: SqlParam[] = []) => {
      await db.runAsync(sql, params);
    },
    all: <T>(sql: string, params: SqlParam[] = []) => db.getAllAsync<T>(sql, params),
    async transaction(fn) {
      // Transactions imbriquées : seule la plus externe ouvre et valide.
      if (depth > 0) return fn();
      depth += 1;
      try {
        await db.withTransactionAsync(fn);
      } finally {
        depth -= 1;
      }
    },
  };
}
