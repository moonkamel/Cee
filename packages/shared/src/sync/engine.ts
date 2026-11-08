import { LOCAL_SCHEMA } from './schema';
import {
  SYNCED_TABLES,
  type Remote,
  type Row,
  type SqlDb,
  type SyncStatus,
  type SyncedTable,
} from './types';

/** Recouvrement de la fenêtre de réception : une transaction validée en retard n'est pas perdue. */
export const PULL_OVERLAP_MS = 5 * 60_000;
/** Rafraîchissement complet périodique : retire les chantiers qui ne nous sont plus affectés. */
export const FULL_REFRESH_MS = 30 * 60_000;
const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS = 10 * 60_000;

export type SyncReport = { pushed: number; rejected: number; pulled: number; offline: boolean };

type OutboxRow = {
  seq: number;
  op: 'insert' | 'update';
  tbl: SyncedTable;
  row_id: string;
  payload: string;
  attempts: number;
};

/** Identifiant local d'une ligne : ses colonnes clés jointes par « : ». */
export function rowId(table: SyncedTable, row: Row): string {
  return SYNCED_TABLES[table].key.map((k) => String(row[k] ?? '')).join(':');
}

/** Les champs qui commencent par « _ » restent sur le téléphone (ex. _addressPending). */
function serverFields(row: Row): Row {
  return Object.fromEntries(Object.entries(row).filter(([k]) => !k.startsWith('_')));
}

function localFields(row: Row): Row {
  return Object.fromEntries(Object.entries(row).filter(([k]) => k.startsWith('_')));
}

export function backoffMs(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1), BACKOFF_MAX_MS);
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;

export function createSyncEngine({
  db,
  remote,
  now = () => Date.now(),
}: {
  db: SqlDb;
  remote: Remote;
  now?: () => number;
}) {
  const listeners = new Set<() => void>();
  let running: Promise<SyncReport> | null = null;
  let offline = false;

  const notify = () => listeners.forEach((l) => l());

  async function getState(key: string): Promise<string | null> {
    const rows = await db.all<{ value: string }>('select value from sync_state where key = ?', [
      key,
    ]);
    return rows[0]?.value ?? null;
  }

  async function setState(key: string, value: string): Promise<void> {
    await db.run(
      'insert into sync_state (key, value) values (?, ?) on conflict (key) do update set value = excluded.value',
      [key, value],
    );
  }

  async function readRow(table: SyncedTable, id: string): Promise<Row | null> {
    const rows = await db.all<{ data: string }>(
      'select data from local_rows where tbl = ? and id = ?',
      [table, id],
    );
    return rows[0] ? (JSON.parse(rows[0].data) as Row) : null;
  }

  async function saveRow(table: SyncedTable, id: string, data: Row): Promise<void> {
    await db.run(
      `insert into local_rows (tbl, id, data) values (?, ?, ?)
       on conflict (tbl, id) do update set data = excluded.data`,
      [table, id, JSON.stringify(data)],
    );
  }

  async function hasPending(table: SyncedTable, id: string): Promise<boolean> {
    const rows = await db.all<{ n: number }>(
      "select count(*) as n from outbox where tbl = ? and row_id = ? and status = 'pending'",
      [table, id],
    );
    return (rows[0]?.n ?? 0) > 0;
  }

  async function push(
    force: boolean,
  ): Promise<{ pushed: number; rejected: number; offline: boolean }> {
    let pushed = 0;
    let rejected = 0;
    const queue = await db.all<OutboxRow & { next_attempt_at: number }>(
      "select seq, op, tbl, row_id, payload, attempts, next_attempt_at from outbox where status = 'pending' order by seq",
    );
    // La file est rejouée dans l'ordre : après un échec, on attend le délai de la plus ancienne.
    const first = queue[0];
    if (first && !force && first.next_attempt_at > now())
      return { pushed, rejected, offline: true };

    for (const item of queue) {
      const payload = JSON.parse(item.payload) as Row;
      const key = Object.fromEntries(SYNCED_TABLES[item.tbl].key.map((k) => [k, payload[k]]));
      const result =
        item.op === 'insert'
          ? await remote.insert(item.tbl, payload)
          : await remote.update(item.tbl, key, payload);

      if (result.ok) {
        await db.run('delete from outbox where seq = ?', [item.seq]);
        pushed += 1;
      } else if (result.kind === 'rejected') {
        await db.run("update outbox set status = 'rejected', last_error = ? where seq = ?", [
          result.message,
          item.seq,
        ]);
        rejected += 1;
      } else {
        const attempts = item.attempts + 1;
        await db.run(
          'update outbox set attempts = ?, next_attempt_at = ?, last_error = ? where seq = ?',
          [attempts, now() + backoffMs(attempts), result.message, item.seq],
        );
        return { pushed, rejected, offline: true };
      }
    }
    return { pushed, rejected, offline: false };
  }

  async function pull(): Promise<{ pulled: number; offline: boolean }> {
    let pulled = 0;
    const lastFull = Number((await getState('last_full_refresh')) ?? 0);
    const full = now() - lastFull >= FULL_REFRESH_MS;

    for (const table of Object.keys(SYNCED_TABLES) as SyncedTable[]) {
      const { cursor: cursorCol } = SYNCED_TABLES[table];
      const cursor = full ? null : await getState(`cursor:${table}`);
      const since = cursor ? new Date(Date.parse(cursor) - PULL_OVERLAP_MS).toISOString() : null;
      const result = await remote.pull(table, since);
      if (!result.ok) return { pulled, offline: result.kind === 'retry' };

      let maxCursor = cursor;
      await db.transaction(async () => {
        const seen = new Set<string>();
        for (const serverRow of result.data) {
          const id = rowId(table, serverRow);
          seen.add(id);
          const value = serverRow[cursorCol];
          if (typeof value === 'string' && (!maxCursor || value > maxCursor)) maxCursor = value;
          // Une modification locale en attente l'emporte jusqu'à son envoi.
          if (await hasPending(table, id)) continue;
          const existing = await readRow(table, id);
          await saveRow(table, id, { ...serverRow, ...(existing ? localFields(existing) : {}) });
          pulled += 1;
        }
        if (full) {
          // Lignes devenues invisibles (chantier réaffecté…) : retirées, sauf si en attente d'envoi.
          const local = await db.all<{ id: string }>('select id from local_rows where tbl = ?', [
            table,
          ]);
          for (const { id } of local) {
            if (!seen.has(id) && !(await hasPending(table, id))) {
              await db.run('delete from local_rows where tbl = ? and id = ?', [table, id]);
            }
          }
        }
      });
      if (maxCursor) await setState(`cursor:${table}`, maxCursor);
    }
    if (full) await setState('last_full_refresh', String(now()));
    return { pulled, offline: false };
  }

  return {
    async init(): Promise<void> {
      await db.exec(LOCAL_SCHEMA);
    },

    onChange(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Lignes locales d'une table (champs serveur et champs locaux « _ »). */
    async rows(table: SyncedTable): Promise<Row[]> {
      const rows = await db.all<{ data: string }>('select data from local_rows where tbl = ?', [
        table,
      ]);
      return rows.map((r) => JSON.parse(r.data) as Row);
    },

    /**
     * Écrit d'abord sur le téléphone, puis met la modification en file d'envoi.
     * L'écran se met à jour tout de suite, réseau ou pas (principe 5).
     */
    async write(table: SyncedTable, op: 'insert' | 'update', row: Row): Promise<void> {
      const id = rowId(table, row);
      await db.transaction(async () => {
        const existing = op === 'update' ? await readRow(table, id) : null;
        await saveRow(table, id, { ...(existing ?? {}), ...row });
        const keyCols = SYNCED_TABLES[table].key;
        const payload = serverFields(row);
        for (const k of keyCols) payload[k] = row[k];
        if (Object.keys(payload).length > keyCols.length || op === 'insert') {
          await db.run('insert into outbox (op, tbl, row_id, payload) values (?, ?, ?, ?)', [
            op,
            table,
            id,
            JSON.stringify(payload),
          ]);
        }
      });
      notify();
    },

    /** La ligne est arrivée sur le serveur : plus rien en file pour elle (ni en attente, ni refusé). */
    async isSynced(table: SyncedTable, id: string): Promise<boolean> {
      const rows = await db.all<{ n: number }>(
        'select count(*) as n from outbox where tbl = ? and row_id = ?',
        [table, id],
      );
      return (rows[0]?.n ?? 0) === 0;
    },

    async status(): Promise<SyncStatus> {
      const counts = await db.all<{ status: string; n: number }>(
        'select status, count(*) as n from outbox group by status',
      );
      const count = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;
      return {
        pending: count('pending'),
        rejected: count('rejected'),
        lastSyncAt: await getState('last_sync_at'),
        offline,
      };
    },

    /**
     * Envoie la file puis reçoit les nouveautés. Un seul passage à la fois.
     * `force` ignore le délai d'attente après échec (retour du réseau, geste de l'utilisateur).
     */
    sync({ force = false }: { force?: boolean } = {}): Promise<SyncReport> {
      if (running) return running;
      running = (async () => {
        try {
          const pushed = await push(force);
          if (pushed.offline) {
            offline = true;
            return { pushed: pushed.pushed, rejected: pushed.rejected, pulled: 0, offline: true };
          }
          const pulled = await pull();
          offline = pulled.offline;
          if (!pulled.offline) await setState('last_sync_at', new Date(now()).toISOString());
          return {
            pushed: pushed.pushed,
            rejected: pushed.rejected,
            pulled: pulled.pulled,
            offline,
          };
        } finally {
          running = null;
          notify();
        }
      })();
      return running;
    },

    /** Modifications refusées par le serveur, avec leur motif (affichage, diagnostic). */
    async rejectedItems(): Promise<
      { table: SyncedTable; rowId: string; op: string; error: string }[]
    > {
      const rows = await db.all<{
        tbl: SyncedTable;
        row_id: string;
        op: string;
        last_error: string | null;
      }>("select tbl, row_id, op, last_error from outbox where status = 'rejected' order by seq");
      return rows.map((r) => ({
        table: r.tbl,
        rowId: r.row_id,
        op: r.op,
        error: r.last_error ?? '',
      }));
    },

    /** Valeur mémorisée sur le téléphone (ex. propriétaire des données locales). */
    getMeta: (key: string) => getState(`meta:${key}`),
    setMeta: (key: string, value: string) => setState(`meta:${key}`, value),

    /** Efface toutes les données locales (déconnexion, changement d'utilisateur). */
    async reset(): Promise<void> {
      await db.transaction(async () => {
        await db.run('delete from local_rows');
        await db.run('delete from outbox');
        await db.run('delete from sync_state');
      });
      offline = false;
      notify();
    },
  };
}
