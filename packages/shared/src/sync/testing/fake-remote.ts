// Faux serveur en mémoire pour tester le moteur : coupure réseau, refus, horodatage serveur.
import {
  SYNCED_TABLES,
  type Remote,
  type RemoteResult,
  type Row,
  type SyncedTable,
} from '../types';

export function createFakeRemote(clock: () => number) {
  const tables = new Map<SyncedTable, Map<string, Row>>();
  const state = { online: true, rejectTables: new Set<SyncedTable>(), calls: 0 };
  const key = (t: SyncedTable, r: Row) => SYNCED_TABLES[t].key.map((k) => String(r[k])).join(':');
  const table = (t: SyncedTable) => {
    if (!tables.has(t)) tables.set(t, new Map());
    return tables.get(t)!;
  };
  const stamp = () => new Date(clock()).toISOString();
  const down = <T>(): RemoteResult<T> => ({
    ok: false,
    kind: 'retry',
    message: 'réseau indisponible',
  });

  const remote: Remote = {
    async insert(t, row) {
      state.calls += 1;
      if (!state.online) return down();
      if (state.rejectTables.has(t)) return { ok: false, kind: 'rejected', message: 'refusé' };
      const id = key(t, row);
      if (!table(t).has(id)) {
        const cursor = SYNCED_TABLES[t].cursor;
        table(t).set(id, { ...row, company_id: 'c1', [cursor]: stamp() });
      }
      return { ok: true, data: null };
    },
    async update(t, k, patch) {
      state.calls += 1;
      if (!state.online) return down();
      const existing = table(t).get(key(t, k));
      if (!existing) return { ok: false, kind: 'rejected', message: 'ligne invisible' };
      table(t).set(key(t, k), { ...existing, ...patch, updated_at: stamp() });
      return { ok: true, data: null };
    },
    async pull(t, since) {
      state.calls += 1;
      if (!state.online) return down();
      const cursor = SYNCED_TABLES[t].cursor;
      const rows = [...table(t).values()].filter((r) => !since || String(r[cursor]) >= since);
      return { ok: true, data: rows };
    },
  };

  return {
    remote,
    state,
    rows: (t: SyncedTable) => [...table(t).values()],
    /** Écriture faite par quelqu'un d'autre, directement sur le serveur. */
    serverWrite: (t: SyncedTable, row: Row) => {
      table(t).set(key(t, row), { ...row, [SYNCED_TABLES[t].cursor]: stamp() });
    },
    serverDelete: (t: SyncedTable, row: Row) => table(t).delete(key(t, row)),
  };
}
