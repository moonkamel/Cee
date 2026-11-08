// Synchronisation hors ligne (section 4) : base locale SQLite + file de modifications.
// Choix documenté dans docs/decisions/0001-synchronisation.md : la RLS de Supabase reste
// la seule règle d'accès, toutes les écritures passent par l'API comme en ligne.

export type SqlParam = string | number | null;

/** Base SQLite locale, quelle que soit la plateforme (expo-sqlite, node:sqlite…). */
export interface SqlDb {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlParam[]): Promise<void>;
  all<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  transaction(fn: () => Promise<void>): Promise<void>;
}

export type Row = Record<string, unknown>;

/**
 * Réponse du serveur. `retry` : réseau absent, session expirée, serveur indisponible —
 * on réessaiera plus tard. `rejected` : refus définitif (droits, données invalides).
 */
export type RemoteResult<T> =
  { ok: true; data: T } | { ok: false; kind: 'retry' | 'rejected'; message: string };

/** Serveur distant. L'insertion est idempotente : un envoi répété ne crée pas de doublon. */
export interface Remote {
  insert(table: SyncedTable, row: Row): Promise<RemoteResult<null>>;
  update(table: SyncedTable, key: Row, patch: Row): Promise<RemoteResult<null>>;
  pull(table: SyncedTable, since: string | null): Promise<RemoteResult<Row[]>>;
}

/** Tables synchronisées, dans l'ordre de réception (parents avant enfants). */
export const SYNCED_TABLES = {
  companies: { key: ['id'], cursor: 'updated_at' },
  profiles: { key: ['id'], cursor: 'updated_at' },
  clients: { key: ['id'], cursor: 'updated_at' },
  jobsites: { key: ['id'], cursor: 'updated_at' },
  jobsite_assignees: { key: ['jobsite_id', 'profile_id'], cursor: 'created_at' },
  // Lecture seule sur le téléphone : modèles globaux et de l'entreprise, pour générer hors ligne.
  checklist_templates: { key: ['id'], cursor: 'updated_at' },
  jobsite_operations: { key: ['id'], cursor: 'updated_at' },
  proof_slots: { key: ['id'], cursor: 'updated_at' },
  photos: { key: ['id'], cursor: 'updated_at' },
} as const satisfies Record<string, { key: readonly string[]; cursor: string }>;

export type SyncedTable = keyof typeof SYNCED_TABLES;

export type SyncStatus = {
  /** Modifications locales pas encore acceptées par le serveur. */
  pending: number;
  /** Modifications refusées par le serveur, mises de côté. */
  rejected: number;
  /** Dernière synchronisation complète réussie (ISO), ou null. */
  lastSyncAt: string | null;
  /** La dernière tentative n'a pas pu joindre le serveur. */
  offline: boolean;
};
