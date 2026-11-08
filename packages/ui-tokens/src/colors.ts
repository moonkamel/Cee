// Jetons de couleur de la section 3. Aucun écran ne code une couleur en dur.

export const colors = {
  /** Bouton principal, déclencheur photo (orange chantier). */
  action: { light: '#EA580C', dark: '#FB923C' },
  /** En-têtes, liens, éléments de marque (bleu ardoise). */
  brand: { light: '#1F3A5F', dark: '#93C5FD' },
  /** Preuve validée, chantier conforme. */
  ok: { light: '#15803D', dark: '#4ADE80' },
  /** Preuve à reprendre, chantier à risque. */
  warn: { light: '#A16207', dark: '#FACC15' },
  /** Preuve manquante, erreur. */
  ko: { light: '#B91C1C', dark: '#F87171' },
  /** Fond d'écran. */
  bg: { light: '#F8FAFC', dark: '#0B1220' },
  /** Cartes, feuilles. */
  surface: { light: '#FFFFFF', dark: '#111A2E' },
  /** Texte principal. */
  text: { light: '#0F172A', dark: '#F1F5F9' },
  /** Texte secondaire. */
  'text-muted': { light: '#475569', dark: '#94A3B8' },
} as const;

export type ColorToken = keyof typeof colors;
export type ColorScheme = 'light' | 'dark';

/** Palette résolue pour un mode d'affichage. */
export function palette(scheme: ColorScheme): Record<ColorToken, string> {
  return Object.fromEntries(
    Object.entries(colors).map(([token, value]) => [token, value[scheme]]),
  ) as Record<ColorToken, string>;
}
