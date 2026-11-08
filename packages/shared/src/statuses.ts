// Cycles de vie définis dans la section 5 du cahier des charges.

/** Statuts d'un chantier, dans l'ordre du cycle de vie. */
export const JOBSITE_STATUSES = [
  'planned', // planifié
  'in_progress', // en cours
  'completed_by_installer', // terminé par le poseur
  'verified_by_office', // vérifié par le bureau
  'exported', // exporté
  'inspected', // contrôlé (voir InspectionResult)
] as const;
export type JobsiteStatus = (typeof JOBSITE_STATUSES)[number];

/** Statuts d'un emplacement de preuve. */
export const PROOF_SLOT_STATUSES = [
  'missing', // manquant
  'captured', // capturé
  'analyzing', // en analyse
  'compliant', // conforme
  'to_retake', // à reprendre
  'manually_validated', // validé manuellement
  'waived', // dispensé (motif obligatoire)
] as const;
export type ProofSlotStatus = (typeof PROOF_SLOT_STATUSES)[number];

/** Phase d'une preuve dans le chantier (section 7). */
export const PROOF_PHASES = ['avant', 'pendant', 'apres'] as const;
export type ProofPhase = (typeof PROOF_PHASES)[number];

/** Résultat d'un contrôle subi (sections 5 et 10). */
export const INSPECTION_RESULTS = ['satisfactory', 'unsatisfactory', 'unverifiable'] as const;
export type InspectionResult = (typeof INSPECTION_RESULTS)[number];

/** Rôles utilisateurs (table profiles, section 5). */
export const ROLES = ['owner', 'admin', 'office', 'lead', 'installer'] as const;
export type Role = (typeof ROLES)[number];

/** Types de travaux proposés à la création rapide d'un chantier (section 6). */
export const WORK_TYPES = [
  'pac_air_eau',
  'combles',
  'murs',
  'vmc',
  'biomasse',
  'menuiseries',
  'photovoltaique',
] as const;
export type WorkType = (typeof WORK_TYPES)[number];
