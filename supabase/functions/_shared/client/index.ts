// Généré depuis packages/shared/src/client/index.ts : ne pas modifier à la main.
// Page client et PV de réception (section 12, S16) : liens, galeries, contenu du PV et son
// empreinte. Logique pure, partagée par le web et la fonction serveur client-portal.

/** Durée d'un lien client, prolongeable par le bureau (section 12). */
export const LINK_DAYS = 90;
export const CODE_MINUTES = 10;
export const MAX_ATTEMPTS = 5;

/** Jeton de lien : 32 octets aléatoires, en base64url (seule son empreinte est stockée). */
export function newLinkToken(
  random: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer> = (b) =>
    crypto.getRandomValues(b),
): string {
  const bytes = random(new Uint8Array(32));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

/** Code SMS à 6 chiffres. */
export function newSmsCode(
  random: (bytes: Uint32Array<ArrayBuffer>) => Uint32Array<ArrayBuffer> = (b) =>
    crypto.getRandomValues(b),
): string {
  return String(random(new Uint32Array(1))[0]! % 1_000_000).padStart(6, '0');
}

/** Nouvelle fin de validité : 90 jours à partir d'aujourd'hui ou de l'échéance, la plus tardive. */
export function extendedExpiry(current: string, now: string, days = LINK_DAYS): string {
  const base = Math.max(new Date(current).getTime(), new Date(now).getTime());
  return new Date(base + days * 86_400_000).toISOString();
}

/** « 06 39 98 •• 10 » : le client reconnaît son numéro sans qu'il soit affiché en entier. */
export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, '').replace(/^33/, '0');
  if (d.length !== 10) return '';
  return `${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 6)} •• ${d.slice(8, 10)}`;
}

export const GALLERY_PHASES = ['avant', 'pendant', 'apres', 'divers'] as const;
export type GalleryPhase = (typeof GALLERY_PHASES)[number];
export const GALLERY_TITLES: Record<GalleryPhase, string> = {
  avant: 'Avant',
  pendant: 'Pendant',
  apres: 'Après',
  divers: 'Autres photos',
};

/** Galeries « Avant », « Pendant », « Après » (puis les photos libres montrées par le bureau). */
export function galleries<T extends { phase: string; taken_at: string }>(
  photos: readonly T[],
): { phase: GalleryPhase; photos: T[] }[] {
  return GALLERY_PHASES.map((phase) => ({
    phase,
    photos: photos
      .filter(
        (p) => (GALLERY_PHASES.includes(p.phase as GalleryPhase) ? p.phase : 'divers') === phase,
      )
      .sort((a, b) => a.taken_at.localeCompare(b.taken_at)),
  })).filter((g) => g.photos.length > 0);
}

/** JSON aux clés triées : la même donnée donne toujours la même empreinte. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export type PvContent = {
  title: string;
  company: { name: string; siret: string | null; rge: string[] };
  client: string;
  address: string;
  reference: string | null;
  works: string[];
  /** Phrase de réception (sans ou avec réserves). */
  declaration: string;
  reserves: string | null;
  signer: string;
  signedAt: string;
  marketingConsent: boolean;
  smsVerified: boolean;
};

export const PV_TITLE = 'Procès-verbal de réception des travaux';
export const MARKETING_CONSENT_LABEL =
  'J’accepte que l’entreprise utilise des photos de ces travaux, sans élément permettant de m’identifier, pour présenter son savoir-faire.';

/** Contenu du PV présenté au client puis signé : il est figé et son empreinte enregistrée. */
export function pvContent(input: {
  company: { name: string; siret?: string | null; rge?: unknown };
  client: string | null;
  address: string;
  reference: string | null;
  operations: readonly string[];
  reserves: string | null;
  signer: string;
  signedAt: string;
  marketingConsent: boolean;
  smsVerified: boolean;
}): PvContent {
  const reserves = input.reserves?.trim() || null;
  const rge = (Array.isArray(input.company.rge) ? input.company.rge : []).flatMap((q) => {
    const r = q as { organisme?: string; numero?: string };
    const s = [r.organisme, r.numero].filter(Boolean).join(' ');
    return s ? [s] : [];
  });
  return {
    title: PV_TITLE,
    company: { name: input.company.name, siret: input.company.siret ?? null, rge },
    client: input.client?.trim() || input.signer.trim(),
    address: input.address,
    reference: input.reference,
    works: [...input.operations],
    declaration: reserves
      ? 'Le maître d’ouvrage déclare réceptionner les travaux ci-dessus, avec les réserves suivantes.'
      : 'Le maître d’ouvrage déclare réceptionner les travaux ci-dessus, sans réserve.',
    reserves,
    signer: input.signer.trim(),
    signedAt: input.signedAt,
    marketingConsent: input.marketingConsent,
    smsVerified: input.smsVerified,
  };
}

/** Avis Google proposé seulement après un PV sans réserve, et si l'entreprise a donné son lien. */
export function offerReview(
  signature: { has_reserves: boolean } | null,
  url: string | null,
): boolean {
  return Boolean(signature && !signature.has_reserves && url?.startsWith('https://'));
}
