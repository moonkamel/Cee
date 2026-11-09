// Recyclage marketing des photos (section 13, S17) : ville affichée, chantier éligible, zones à
// flouter, mise en page des visuels carré et vertical, légendes sans adresse.
// Fichier recopié pour les Edge Functions (voir ai/deno-copy.ts) : aucun import.

// --- Tons des légendes --------------------------------------------------------------------------

export const MARKETING_TONES = ['sobre', 'chaleureux', 'technique'] as const;
export type MarketingTone = (typeof MARKETING_TONES)[number];
export const TONE_LABELS: Record<MarketingTone, string> = {
  sobre: 'Sobre',
  chaleureux: 'Chaleureux',
  technique: 'Technique',
};
export function isTone(value: unknown): value is MarketingTone {
  return MARKETING_TONES.includes(value as MarketingTone);
}

export type MarketingCaptions = Record<MarketingTone, string>;

// --- Ville, jamais l'adresse --------------------------------------------------------------------

/**
 * Ville d'une adresse au format de la Base Adresse Nationale (« 14 Rue des Ajoncs 44400 Rezé ») :
 * ce qui suit le code postal. Sans code postal, rien n'est affiché plutôt qu'un bout d'adresse.
 */
export function cityOf(address: string | null | undefined): string | null {
  const m = /\b\d{5}\s+(.+)$/.exec((address ?? '').trim());
  const city = m?.[1]?.replace(/\s*cedex\b.*$/i, '').trim();
  return city ? city : null;
}

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Une légende laisse-t-elle deviner l'adresse ou le client ? Numéro et nom de rue, code postal,
 * nom du client : la légende est alors écartée (la ville seule est permise).
 */
export function captionLeaks(
  caption: string,
  context: { address: string; client?: string | null },
): boolean {
  const text = ` ${normalize(caption)} `;
  const address = context.address.trim();
  const postal = /\b(\d{5})\b/.exec(address)?.[1];
  if (postal && text.includes(` ${postal} `)) return true;
  const street = normalize(address.replace(/\b\d{5}\b.*$/, ''));
  const streetName = street.replace(/^\d+\s*(bis|ter)?\s*/, '');
  if (streetName.length >= 6 && text.includes(` ${streetName} `)) return true;
  const number = /^(\d+)/.exec(street)?.[1];
  if (number && streetName && text.includes(` ${number} ${streetName.split(' ')[0]} `)) {
    return true;
  }
  const names = normalize(context.client ?? '')
    .split(' ')
    .filter((w) => w.length >= 3 && !['mme', 'mlle', 'monsieur', 'madame'].includes(w));
  return names.some((w) => text.includes(` ${w} `));
}

/** Légende nettoyée : espaces, longueur bornée (fiche Google : 1 500 caractères). */
export function cleanCaption(caption: string, max = 1500): string {
  const text = caption.replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

// --- Chantier « terminé et conforme » -----------------------------------------------------------

export const FINISHED_STATUSES = [
  'completed_by_installer',
  'verified_by_office',
  'exported',
  'inspected',
] as const;
/** Statuts d'emplacement de preuve (voir statuses.ts) qui valent preuve validée. */
export const VALIDATED_STATUSES = ['compliant', 'manually_validated', 'waived'] as const;

/**
 * Un contenu n'est créé que pour un chantier terminé, dont toutes les preuves exigées sont
 * validées, et dont le PV porte la case de consentement cochée (section 13).
 */
export function marketingEligible(input: {
  jobsiteStatus: string;
  slots: { required: boolean; applicable: boolean; status: string }[];
  marketingConsent: boolean;
}): boolean {
  if (!input.marketingConsent) return false;
  if (!(FINISHED_STATUSES as readonly string[]).includes(input.jobsiteStatus)) return false;
  return input.slots
    .filter((s) => s.applicable && s.required)
    .every((s) => (VALIDATED_STATUSES as readonly string[]).includes(s.status));
}

// --- Zones à flouter ----------------------------------------------------------------------------

export const BLUR_KINDS = ['face', 'plate', 'street_number'] as const;
export type BlurKind = (typeof BLUR_KINDS)[number];
/** Rectangle en fractions de la photo (0 à 1), origine en haut à gauche. */
export type BlurRegion = { x: number; y: number; w: number; h: number; kind: BlurKind };

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Zones renvoyées par l'IA → zones sûres : bornées à la photo, élargies d'une marge (mieux vaut
 * flouter un peu trop), les zones vides ou absurdes écartées, au plus 20.
 */
export function safeRegions(regions: readonly unknown[], margin = 0.25): BlurRegion[] {
  const out: BlurRegion[] = [];
  for (const r of regions) {
    const v = (r ?? {}) as Partial<BlurRegion>;
    if (!BLUR_KINDS.includes(v.kind as BlurKind)) continue;
    const nums = [v.x, v.y, v.w, v.h];
    if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n))) continue;
    if (v.w! <= 0 || v.h! <= 0) continue;
    const dx = v.w! * margin;
    const dy = v.h! * margin;
    const x0 = clamp(v.x! - dx);
    const y0 = clamp(v.y! - dy);
    const x1 = clamp(v.x! + v.w! + dx);
    const y1 = clamp(v.y! + v.h! + dy);
    if (x1 - x0 < 0.005 || y1 - y0 < 0.005) continue;
    out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, kind: v.kind as BlurKind });
    if (out.length === 20) break;
  }
  return out;
}

/** Zone en fractions → rectangle en pixels entiers, toujours dans l'image et non vide. */
export function regionPixels(
  r: BlurRegion,
  width: number,
  height: number,
): { left: number; top: number; width: number; height: number } {
  const left = Math.min(width - 1, Math.max(0, Math.floor(r.x * width)));
  const top = Math.min(height - 1, Math.max(0, Math.floor(r.y * height)));
  const right = Math.min(width, Math.max(left + 1, Math.ceil((r.x + r.w) * width)));
  const bottom = Math.min(height, Math.max(top + 1, Math.ceil((r.y + r.h) * height)));
  return { left, top, width: right - left, height: bottom - top };
}

// --- Mise en page des visuels -------------------------------------------------------------------

export const FORMATS = {
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
} as const;
export type MarketingFormat = keyof typeof FORMATS;
export function isFormat(value: unknown): value is MarketingFormat {
  return value === 'square' || value === 'story';
}

type Box = { left: number; top: number; width: number; height: number };
export type MarketingLayout = {
  width: number;
  height: number;
  before: Box;
  after: Box;
  band: Box;
  /** Étiquettes « Avant » et « Après », posées en haut à gauche de chaque photo. */
  labelSize: number;
};

/**
 * Carré : avant à gauche, après à droite, bandeau en bas. Vertical : avant en haut, après en
 * dessous, bandeau en bas. Le bandeau porte le logo, le nom de l'entreprise et la ville.
 */
export function marketingLayout(format: MarketingFormat): MarketingLayout {
  const { width, height } = FORMATS[format];
  const band = format === 'square' ? 160 : 220;
  const gap = 8;
  const photoH = height - band;
  if (format === 'square') {
    const w = (width - gap) / 2;
    return {
      width,
      height,
      before: { left: 0, top: 0, width: w, height: photoH },
      after: { left: w + gap, top: 0, width: w, height: photoH },
      band: { left: 0, top: photoH, width, height: band },
      labelSize: 44,
    };
  }
  const h = (photoH - gap) / 2;
  return {
    width,
    height,
    before: { left: 0, top: 0, width, height: h },
    after: { left: 0, top: h + gap, width, height: h },
    band: { left: 0, top: photoH, width, height: band },
    labelSize: 56,
  };
}

/** Texte du bandeau : nom de l'entreprise et ville (jamais l'adresse). */
export function bandText(company: string, city: string | null): string {
  return city ? `${company} · ${city}` : company;
}

/** Nom des fichiers partagés : neutre, sans adresse ni nom du client. */
export function shareFileName(company: string, format: MarketingFormat): string {
  const slug = normalize(company).replace(/\s+/g, '-') || 'realisation';
  return `${slug}-avant-apres-${format === 'square' ? 'carre' : 'vertical'}.jpg`;
}
