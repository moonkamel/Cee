import type {
  Annotation,
  JobsiteStatus,
  PhotoSource,
  ProofPhase,
  ProofSlotStatus,
  QuickJobsiteInput,
  Role,
  SyncStatus,
  TodayJobsiteInput,
  UploadBlock,
  WaiverReason,
  WorkType,
} from '@preuvio/shared';
import type { LocalCheck } from '@/lib/photo-quality';

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
  operationId: string | null;
  instruction: string;
  phase: ProofPhase;
  position: number;
  required: boolean;
  minPhotos: number;
  status: ProofSlotStatus;
  /** Faux si une réponse l'a écartée : ni affichée, ni comptée. */
  applicable: boolean;
  waiverReason: string | null;
  waiverValidated: boolean;
  /** Message de l'IA (alerte orange), sur la dernière photo de la preuve. */
  aiMessage: string | null;
  /** Photo gardée malgré l'alerte (« Garder quand même ») : le bureau tranche. */
  aiKept: boolean;
};

/** Question rapide d'une opération, avec sa réponse actuelle (ou celle par défaut). */
export type OperationQuestion =
  | { key: string; label: string; type: 'yes_no'; value: boolean | null }
  | { key: string; label: string; type: 'number'; min: number; max: number; value: number };

/** Opération d'un chantier (un geste CEE) et ses questions rapides. */
export type Operation = {
  id: string;
  label: string;
  /** Modèle pas encore relu par un professionnel (section 7). */
  draft: boolean;
  questions: OperationQuestion[];
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

/** Demande de reprise du bureau, adressée à ce poseur. */
export type PhotoRequest = {
  id: string;
  jobsiteId: string;
  jobsiteAddress: string;
  proofSlotId: string | null;
  instruction: string | null;
  message: string | null;
  requestedAt: string;
};

/** Note vocale, telle que l'écran l'affiche. */
export type VoiceNote = {
  id: string;
  jobsiteId: string;
  photoId: string | null;
  durationS: number;
  createdAt: string;
  status: 'pending' | 'transcribing' | 'done' | 'failed';
  /** Texte nettoyé par l'IA, sinon la transcription brute, sinon null (en attente). */
  text: string | null;
  /** Problèmes et matériel repérés dans la note, transmis au bureau. */
  items: {
    kind: 'problem' | 'material';
    summary: string;
    quantity: number | null;
    unit: string | null;
  }[];
};

/** Photo affichée en grand, avec son calque d'annotations. */
export type PhotoDetail = PhotoSummary & {
  uri: string | null;
  annotations: Annotation[];
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
  /** Contrôle local de netteté et de luminosité (S9), s'il a été fait. */
  localCheck?: LocalCheck | null;
};

export type Profile = { id: string; fullName: string; role: Role; companyName: string | null };

export type CachedResult<T> = {
  data: T;
  /** La dernière synchronisation n'a pas pu joindre le serveur. */
  stale: boolean;
  /** Dernière synchronisation réussie (ISO), ou l'instant de lecture si aucune. */
  fetchedAt: string;
};

/** État de synchronisation, avec les photos dont l'original n'est pas encore confirmé. */
export type AppSyncStatus = SyncStatus & {
  photosWaiting: number;
  /** Envoi des photos en pause : batterie faible, attente du Wi-Fi, hors ligne. */
  uploadBlocked: UploadBlock | null;
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
  /** Preuves applicables du chantier (les preuves écartées par une réponse sont exclues). */
  listSlots(jobsiteId: string): Promise<ProofSlot[]>;
  listOperations(jobsiteId: string): Promise<Operation[]>;
  /** Répond à une question rapide : la checklist suit (preuves ajoutées, masquées). */
  answerQuestion(operationId: string, key: string, value: boolean | number): Promise<void>;
  /** Marque une preuve « Impossible », avec un motif de la liste. Le bureau la valide. */
  waiveSlot(slotId: string, reason: WaiverReason): Promise<void>;
  /** Note dictée : enregistrée sur le téléphone, envoyée puis transcrite par le serveur. */
  recordVoiceNote(input: {
    id: string;
    jobsiteId: string;
    photoId: string | null;
    localUri: string;
    durationS: number;
  }): Promise<void>;
  listVoiceNotes(jobsiteId: string): Promise<VoiceNote[]>;
  /** Demandes de reprise ouvertes adressées à l'utilisateur (tous chantiers si jobsiteId absent). */
  listPhotoRequests(jobsiteId?: string): Promise<PhotoRequest[]>;
  /** Jeton push du téléphone, enregistré par la file de synchronisation. */
  registerPushToken(token: string, platform: 'ios' | 'android'): Promise<void>;
  getPhoto(photoId: string): Promise<PhotoDetail | null>;
  /** Calque d'annotations (la photo d'origine n'est jamais modifiée). */
  saveAnnotations(photoId: string, annotations: Annotation[]): Promise<void>;
  /** « Garder quand même » après une alerte orange de l'IA : le bureau tranchera. */
  keepDespiteAi(slotId: string): Promise<void>;
  /** « Terminer le chantier » : statut « terminé par le poseur ». */
  finishJobsite(jobsiteId: string): Promise<void>;
  listPhotos(jobsiteId: string): Promise<PhotoSummary[]>;
  /** Enregistre la photo et met la preuve à « capturée » ; tout part au serveur ensuite. */
  recordPhoto(input: RecordPhotoInput): Promise<void>;
  /**
   * Réponse à l'alerte du contrôle local : « Garder » (la photo compte) ou « Reprendre »
   * (retirée logiquement, jamais supprimée ; la preuve redevient à prendre).
   */
  resolvePhotoCheck(photoId: string, keep: boolean): Promise<void>;
  syncStatus(): Promise<AppSyncStatus>;
  /** Synchronise et envoie les photos tout de suite (geste de l'utilisateur). */
  syncNow(): Promise<void>;
  /** Réglage « envoyer les photos en Wi-Fi uniquement » (désactivé par défaut). */
  getWifiOnly(): Promise<boolean>;
  setWifiOnly(value: boolean): Promise<void>;
  /** Prévient quand les données locales ou l'état de synchronisation changent. */
  onChange(listener: () => void): () => void;
  /** Efface tout (déconnexion). */
  reset(): Promise<void>;
}

export type { JobsiteStatus };
