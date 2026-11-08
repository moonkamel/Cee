import type { JobsiteStatus, ProofSlotStatus, Role, TodayJobsiteInput } from '@preuvio/shared';

/** Chantier tel que l'appli l'affiche. */
export type Jobsite = TodayJobsiteInput & {
  reference: string | null;
  address: string;
  clientName: string | null;
  operations: string[];
  proofs: { status: ProofSlotStatus; required: boolean }[];
};

export type Profile = { id: string; fullName: string; role: Role; companyName: string | null };

export type CachedResult<T> = {
  data: T;
  /** Données du dernier passage en ligne, affichées faute de réseau. */
  stale: boolean;
  fetchedAt: string;
};

/**
 * Accès aux données des écrans. S4 : Supabase + cache simple.
 * S5 la remplacera par la base locale synchronisée, sans toucher aux écrans.
 */
export interface DataSource {
  listJobsites(): Promise<CachedResult<Jobsite[]>>;
  cachedJobsites(): Promise<CachedResult<Jobsite[]> | null>;
  getProfile(userId: string): Promise<Profile | null>;
}

export type { JobsiteStatus };
