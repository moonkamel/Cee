// Serveur distant = l'API Supabase, avec la session de l'utilisateur : la RLS s'applique
// exactement comme en ligne. Aucune règle d'accès n'est dupliquée côté téléphone.
import type { SupabaseClient } from '@supabase/supabase-js';
import { SYNCED_TABLES, type Remote, type RemoteResult, type Row } from './types';

const PAGE_SIZE = 1000;

type ApiError = { code?: string; message: string };

/** Réseau, session expirée, serveur saturé ou en panne : on réessaiera. Le reste est un refus. */
export function classifyError(error: ApiError, status: number): RemoteResult<never> {
  const retry = status === 0 || status === 401 || status === 408 || status === 429 || status >= 500;
  if (retry || !error.code) return { ok: false, kind: 'retry', message: error.message };
  return { ok: false, kind: 'rejected', message: `${error.code} ${error.message}` };
}

const networkFailure = (e: unknown): RemoteResult<never> => ({
  ok: false,
  kind: 'retry',
  message: e instanceof Error ? e.message : 'réseau indisponible',
});

export function createSupabaseRemote(client: SupabaseClient): Remote {
  return {
    async insert(table, row) {
      try {
        // Idempotent : un envoi rejoué après une coupure ne crée pas de doublon.
        const { error, status } = await client
          .from(table)
          .upsert(row, { onConflict: SYNCED_TABLES[table].key.join(','), ignoreDuplicates: true });
        return error ? classifyError(error, status) : { ok: true, data: null };
      } catch (e) {
        return networkFailure(e);
      }
    },

    async update(table, key, patch) {
      try {
        const keyCols: readonly string[] = SYNCED_TABLES[table].key;
        const fields: Row = Object.fromEntries(
          Object.entries(patch).filter(([k]) => !keyCols.includes(k)),
        );
        const { data, error, status } = await client
          .from(table)
          .update(fields)
          .match(key as Record<string, string>)
          .select(keyCols.join(','));
        if (error) return classifyError(error, status);
        if (!data || data.length === 0) {
          return { ok: false, kind: 'rejected', message: 'Ligne introuvable ou non modifiable' };
        }
        return { ok: true, data: null };
      } catch (e) {
        return networkFailure(e);
      }
    },

    async pull(table, since) {
      try {
        const { cursor, key } = SYNCED_TABLES[table];
        const rows: Row[] = [];
        for (let from = 0; ; from += PAGE_SIZE) {
          let query = client
            .from(table)
            .select('*')
            .order(cursor, { ascending: true })
            .order(key[0], { ascending: true })
            .range(from, from + PAGE_SIZE - 1);
          if (since) query = query.gte(cursor, since);
          const { data, error, status } = await query;
          if (error) return classifyError(error, status);
          rows.push(...(data as Row[]));
          if (data.length < PAGE_SIZE) break;
        }
        return { ok: true, data: rows };
      } catch (e) {
        return networkFailure(e);
      }
    },
  };
}
