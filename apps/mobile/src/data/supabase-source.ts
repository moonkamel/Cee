import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Role } from '@preuvio/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CachedResult, DataSource, Jobsite, Profile } from './types';

const CACHE_KEY = 'cache:jobsites:v1';

type JobsiteRow = {
  id: string;
  reference: string | null;
  address: string;
  status: Jobsite['status'];
  planned_start: string | null;
  planned_end: string | null;
  lat: number | null;
  lng: number | null;
  geofence_radius_m: number;
  clients: { full_name: string } | null;
  jobsite_operations: { label: string }[];
  proof_slots: { status: Jobsite['proofs'][number]['status']; required: boolean }[];
};

export function toJobsite(row: JobsiteRow): Jobsite {
  return {
    id: row.id,
    reference: row.reference,
    address: row.address,
    status: row.status,
    plannedStart: row.planned_start,
    plannedEnd: row.planned_end,
    lat: row.lat,
    lng: row.lng,
    geofenceRadiusM: row.geofence_radius_m,
    clientName: row.clients?.full_name ?? null,
    operations: row.jobsite_operations.map((o) => o.label),
    proofs: row.proof_slots,
  };
}

/** Chantiers visibles par l'utilisateur (la RLS fait le tri), non terminés. */
const SELECT = `id, reference, address, status, planned_start, planned_end, lat, lng, geofence_radius_m,
  clients ( full_name ), jobsite_operations ( label ), proof_slots ( status, required )`;

export function createSupabaseSource(client: SupabaseClient): DataSource {
  async function cachedJobsites(): Promise<CachedResult<Jobsite[]> | null> {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { data, fetchedAt } = JSON.parse(raw) as { data: Jobsite[]; fetchedAt: string };
      return { data, fetchedAt, stale: true };
    } catch {
      return null;
    }
  }

  return {
    cachedJobsites,

    async listJobsites() {
      const { data, error } = await client
        .from('jobsites')
        .select(SELECT)
        .in('status', ['planned', 'in_progress'])
        .order('planned_start', { ascending: true, nullsFirst: false })
        .returns<JobsiteRow[]>();
      if (error) {
        // Hors ligne ou serveur injoignable : on garde la dernière liste connue.
        const cached = await cachedJobsites();
        if (cached) return cached;
        throw error;
      }
      const result = {
        data: data.map(toJobsite),
        fetchedAt: new Date().toISOString(),
        stale: false,
      };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(result)).catch(() => undefined);
      return result;
    },

    async getProfile(userId: string): Promise<Profile | null> {
      const { data, error } = await client
        .from('profiles')
        .select('id, full_name, role, companies ( name )')
        .eq('id', userId)
        .maybeSingle<{
          id: string;
          full_name: string;
          role: Role;
          companies: { name: string } | null;
        }>();
      if (error || !data) return null;
      return {
        id: data.id,
        fullName: data.full_name,
        role: data.role,
        companyName: data.companies?.name ?? null,
      };
    },
  };
}

export async function clearCache(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY).catch(() => undefined);
}
