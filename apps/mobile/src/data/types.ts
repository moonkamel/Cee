import type {
  JobsiteStatus,
  ProofSlotStatus,
  QuickJobsiteInput,
  Role,
  SyncStatus,
  TodayJobsiteInput,
  WorkType,
} from '@preuvio/shared';

/** Chantier tel que l'appli l'affiche. */
export type Jobsite = TodayJobsiteInput & {
  reference: string | null;
  address: string;
  clientName: string | null;
  operations: string[];
  workTypes: WorkType[];
  proofs: { status: ProofSlotStatus; required: boolean }[];
  /** Adresse provisoire (créé hors ligne), complétée au retour du réseau. */
  addressPending: boolean;
};

export type Profile = { id: string; fullName: string; role: Role; companyName: string | null };

export type CachedResult<T> = {
  data: T;
  /** La dernière synchronisation n'a pas pu joindre le serveur. */
  stale: boolean;
  /** Dernière synchronisation réussie (ISO), ou l'instant de lecture si aucune. */
  fetchedAt: string;
};

export type NewJobsite = Pick<QuickJobsiteInput, 'address' | 'workTypes' | 'client'>;

/**
 * Accès aux données des écrans. Depuis S5 : la base locale du téléphone, synchronisée
 * en arrière-plan. Les écrans ne parlent jamais directement au serveur.
 */
export interface DataSource {
  listJobsites(): Promise<CachedResult<Jobsite[]>>;
  cachedJobsites(): Promise<CachedResult<Jobsite[]> | null>;
  getProfile(userId: string): Promise<Profile | null>;
  /** Crée un chantier sur le téléphone ; il part au serveur dès que possible. Renvoie son id. */
  createJobsite(input: NewJobsite): Promise<string>;
  syncStatus(): Promise<SyncStatus>;
  syncNow(): Promise<void>;
  /** Prévient quand les données locales ou l'état de synchronisation changent. */
  onChange(listener: () => void): () => void;
  /** Efface tout (déconnexion). */
  reset(): Promise<void>;
}

export type { JobsiteStatus };
