import type {
  JobsiteStatus,
  PhotoSource,
  ProofPhase,
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

/** Preuve attendue sur un chantier (emplacement de preuve). */
export type ProofSlot = {
  id: string;
  jobsiteId: string;
  instruction: string;
  phase: ProofPhase;
  position: number;
  required: boolean;
  status: ProofSlotStatus;
};

/** Photo prise sur le téléphone, telle que l'écran l'affiche. */
export type PhotoSummary = {
  id: string;
  proofSlotId: string | null;
  thumbUri: string | null;
  takenAt: string;
  outsideGeofence: boolean;
  source: PhotoSource;
};

/** Photo traitée (fichier enregistré, empreinte, vignette), prête à être enregistrée. */
export type RecordPhotoInput = {
  id: string;
  jobsiteId: string;
  proofSlotId: string | null;
  takenAt: string;
  position: { lat: number; lng: number; accuracyM: number | null } | null;
  headingDeg: number | null;
  sha256: string;
  source: PhotoSource;
  width: number | null;
  height: number | null;
  localUri: string;
  thumbUri: string | null;
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
  listSlots(jobsiteId: string): Promise<ProofSlot[]>;
  listPhotos(jobsiteId: string): Promise<PhotoSummary[]>;
  /** Enregistre la photo et met la preuve à « capturée » ; tout part au serveur ensuite. */
  recordPhoto(input: RecordPhotoInput): Promise<void>;
  syncStatus(): Promise<SyncStatus>;
  syncNow(): Promise<void>;
  /** Prévient quand les données locales ou l'état de synchronisation changent. */
  onChange(listener: () => void): () => void;
  /** Efface tout (déconnexion). */
  reset(): Promise<void>;
}

export type { JobsiteStatus };
