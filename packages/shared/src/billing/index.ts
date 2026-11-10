// Inscription, essai et abonnements (section 15, S18) : offres, sièges, essai gratuit, accès en
// lecture seule, SIRET et recherche d'entreprise, liste RGE de l'ADEME.
import type { WorkType } from '../statuses';

// --- Offres -------------------------------------------------------------------------------------

export const PLANS = ['solo', 'team', 'enterprise'] as const;
export type Plan = (typeof PLANS)[number];
export type BillingInterval = 'month' | 'year';
export type Feature = 'batches' | 'marketing';

export const PLAN_INFO: Record<
  Plan,
  {
    label: string;
    seats: number | null;
    /** Prix HT en centimes ; null : sur devis. Annuel : deux mois offerts. */
    monthly: number | null;
    yearly: number | null;
    features: readonly Feature[];
    summary: string;
  }
> = {
  solo: {
    label: 'Solo',
    seats: 2,
    monthly: 3900,
    yearly: 39000,
    features: [],
    summary: 'Photos, checklists, pré-contrôle IA, exports, portail client',
  },
  team: {
    label: 'Équipe',
    seats: 10,
    monthly: 9900,
    yearly: 99000,
    features: ['batches', 'marketing'],
    summary: 'Solo + tableau de bord, suivi des lots CEE, rôles, marketing',
  },
  enterprise: {
    label: 'Entreprise',
    seats: null,
    monthly: null,
    yearly: null,
    features: ['batches', 'marketing'],
    summary: 'Équipe + modèles personnalisés illimités, accompagnement',
  },
};

export function isPlan(value: unknown): value is Plan {
  return PLANS.includes(value as Plan);
}

/** Prix affiché : « 39 € HT par mois », « 390 € HT par an », « Sur devis ». */
export function priceLabel(plan: Plan, interval: BillingInterval): string {
  const cents = interval === 'month' ? PLAN_INFO[plan].monthly : PLAN_INFO[plan].yearly;
  if (cents === null) return 'Sur devis';
  const euros = (cents / 100).toLocaleString('fr-FR');
  return `${euros} € HT par ${interval === 'month' ? 'mois' : 'an'}`;
}

// --- Essai et accès -----------------------------------------------------------------------------

export const TRIAL_DAYS = 30;
export const TRIAL_JOBSITES = 10;
/** Après l'essai ou la résiliation, les données restent consultables 90 jours. */
export const READ_ONLY_DAYS = 90;
const DAY = 86_400_000;

/** Statuts Stripe qui donnent accès au service (impayé : quelques jours de grâce Stripe). */
const PAYING = ['active', 'trialing', 'past_due'];

export type AccessInput = {
  plan: string;
  trialEndsAt: string | null;
  /** Chantiers réels créés (le chantier de démonstration ne compte pas). */
  jobsites: number;
  subscription: { status: string; plan: string; currentPeriodEnd: string | null } | null;
  now: string;
};

export type Access =
  | { kind: 'trial'; daysLeft: number; jobsitesLeft: number }
  | { kind: 'active'; plan: Plan }
  | { kind: 'read_only'; reason: 'trial_ended' | 'canceled'; until: string }
  | { kind: 'closed' };

/** Où en est l'entreprise : essai, abonnée, lecture seule (90 jours), puis fermée. */
export function companyAccess(input: AccessInput): Access {
  const now = Date.parse(input.now);
  const sub = input.subscription;
  if (sub && PAYING.includes(sub.status) && isPlan(sub.plan)) {
    return { kind: 'active', plan: sub.plan };
  }
  const readOnly = (from: number, reason: 'trial_ended' | 'canceled'): Access => {
    const until = from + READ_ONLY_DAYS * DAY;
    return now < until
      ? { kind: 'read_only', reason, until: new Date(until).toISOString() }
      : { kind: 'closed' };
  };
  if (sub) {
    const end = sub.currentPeriodEnd ? Date.parse(sub.currentPeriodEnd) : now;
    return readOnly(end, 'canceled');
  }
  const trialEnd = input.trialEndsAt ? Date.parse(input.trialEndsAt) : now;
  if (now < trialEnd && input.jobsites < TRIAL_JOBSITES) {
    return {
      kind: 'trial',
      daysLeft: Math.ceil((trialEnd - now) / DAY),
      jobsitesLeft: TRIAL_JOBSITES - input.jobsites,
    };
  }
  // Fin de l'essai : à la date prévue, ou au 10e chantier (lecture seule à partir d'aujourd'hui).
  return readOnly(Math.min(trialEnd, now), 'trial_ended');
}

/** Réponse de my_company_access (SQL, fait foi pour les limites) → Access de packages/shared. */
export function accessFromSql(row: unknown): Access {
  const r = (row ?? {}) as Record<string, unknown>;
  switch (r.kind) {
    case 'trial':
      return {
        kind: 'trial',
        daysLeft: Number(r.days_left),
        jobsitesLeft: Number(r.jobsites_left),
      };
    case 'active':
      return isPlan(r.plan) ? { kind: 'active', plan: r.plan } : { kind: 'closed' };
    case 'read_only':
      return {
        kind: 'read_only',
        reason: r.reason === 'canceled' ? 'canceled' : 'trial_ended',
        until: new Date(String(r.until)).toISOString(),
      };
    default:
      return { kind: 'closed' };
  }
}

/** Créer un chantier, inviter : seulement pendant l'essai ou avec un abonnement. */
export function canWrite(access: Access): boolean {
  return access.kind === 'trial' || access.kind === 'active';
}

/** Pendant l'essai, tout est ouvert ; ensuite selon l'offre (tableau de la section 15). */
export function hasFeature(access: Access, feature: Feature): boolean {
  if (access.kind === 'trial') return true;
  if (access.kind === 'active') return PLAN_INFO[access.plan].features.includes(feature);
  return false;
}

/** Utilisateurs actifs autorisés ; null : pas de limite (essai, offre Entreprise). */
export function seatLimit(access: Access): number | null {
  if (access.kind === 'active') return PLAN_INFO[access.plan].seats;
  if (access.kind === 'trial') return PLAN_INFO.team.seats;
  return 0;
}

export function accessBanner(access: Access): string | null {
  switch (access.kind) {
    case 'trial':
      return `Essai gratuit : ${access.daysLeft} jour(s) et ${access.jobsitesLeft} chantier(s) restants`;
    case 'read_only':
      return `${access.reason === 'trial_ended' ? 'Essai terminé' : 'Abonnement arrêté'} : vos données restent consultables jusqu’au ${new Date(access.until).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}. Choisissez une offre pour continuer.`;
    case 'closed':
      return 'Accès fermé. Choisissez une offre pour retrouver vos chantiers.';
    default:
      return null;
  }
}

// --- SIRET et recherche d'entreprise ------------------------------------------------------------

/** SIRET : 14 chiffres, clé de Luhn (exception de La Poste, SIREN 356000000). */
export function normalizeSiret(input: string): string | null {
  const digits = input.replace(/\s/g, '');
  if (!/^\d{14}$/.test(digits)) return null;
  if (digits.startsWith('356000000')) {
    const sum = [...digits].reduce((s, d) => s + Number(d), 0);
    return sum % 5 === 0 ? digits : null;
  }
  let sum = 0;
  for (let i = 0; i < 14; i += 1) {
    let n = Number(digits[13 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0 ? digits : null;
}

/** API publique « Recherche d'entreprises » (sans clé). */
export function companySearchUrl(siret: string): string {
  return `https://recherche-entreprises.api.gouv.fr/search?q=${siret}&page=1&per_page=1`;
}

export type CompanyIdentity = { name: string; address: string | null; active: boolean };

type SearchEtablissement = {
  siret?: string;
  adresse?: string;
  etat_administratif?: string;
  liste_enseignes?: string[] | null;
};
type SearchResult = {
  nom_complet?: string;
  nom_raison_sociale?: string;
  siege?: SearchEtablissement;
  matching_etablissements?: SearchEtablissement[];
};

/** Réponse de l'API → nom et adresse de l'établissement du SIRET ; null s'il est inconnu. */
export function parseCompanySearch(body: unknown, siret: string): CompanyIdentity | null {
  const results = ((body as { results?: SearchResult[] })?.results ?? []) as SearchResult[];
  for (const r of results) {
    const etab =
      (r.matching_etablissements ?? []).find((e) => e.siret === siret) ??
      (r.siege?.siret === siret ? r.siege : undefined);
    if (!etab) continue;
    const name = (r.nom_raison_sociale || r.nom_complet || '').trim();
    if (!name) continue;
    return {
      name: titleCase(name),
      address: etab.adresse?.trim() || null,
      active: etab.etat_administratif !== 'F',
    };
  }
  return null;
}

/** « ENERGIE ET FILS » → « Energie Et Fils » : le registre écrit en capitales. */
function titleCase(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .replace(/(^|[\s'’-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
}

// --- Liste RGE de l'ADEME (données ouvertes, vérification non bloquante) ------------------------

export function rgeSearchUrl(siret: string): string {
  return `https://data.ademe.fr/data-fair/api/v1/datasets/liste-des-entreprises-rge-2/lines?siret_eq=${siret}&size=50&select=siret,nom_qualification,organisme,code_qualification,lien_date_fin`;
}

export type RgeRow = {
  organisme: string;
  numero: string | null;
  domaine: string;
  dateFin: string | null;
};

/** Lignes de la liste ADEME → qualifications (une par code), sans doublon. */
export function parseRgeLines(body: unknown): RgeRow[] {
  const rows = ((body as { results?: Record<string, unknown>[] })?.results ?? []) as Record<
    string,
    unknown
  >[];
  const seen = new Set<string>();
  const out: RgeRow[] = [];
  for (const r of rows) {
    const organisme = String(r.organisme ?? '').trim();
    const domaine = String(r.nom_qualification ?? '').trim();
    if (!organisme || !domaine) continue;
    const key = `${organisme}|${domaine}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      organisme,
      numero: r.code_qualification ? String(r.code_qualification) : null,
      domaine,
      dateFin: r.lien_date_fin ? String(r.lien_date_fin).slice(0, 10) : null,
    });
  }
  return out;
}

// --- Métiers exercés --------------------------------------------------------------------------

/** Tuiles de l'inscription : les métiers choisis passent en tête à la création d'un chantier. */
export function orderWorkTypes<T extends string>(
  all: readonly T[],
  company: readonly WorkType[],
): T[] {
  const own = all.filter((w) => (company as readonly string[]).includes(w));
  return [...own, ...all.filter((w) => !own.includes(w))];
}
export * from './stripe';
