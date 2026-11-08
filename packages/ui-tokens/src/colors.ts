// Jetons de couleur de la section 3. Aucun écran ne code une couleur en dur.
// Trois modes : clair, sombre, et « contraste maximal » pour le plein soleil.

export const COLOR_SCHEMES = ['light', 'dark', 'contrast'] as const;
export type ColorScheme = (typeof COLOR_SCHEMES)[number];

type TokenValues = Record<ColorScheme, string>;

export const colors = {
  /** Bouton principal, déclencheur photo (orange chantier). */
  action: { light: '#9A3412', dark: '#FB923C', contrast: '#FDBA74' },
  /** Texte et icônes posés sur la couleur action. */
  'on-action': { light: '#FFFFFF', dark: '#0B1220', contrast: '#000000' },
  /** En-têtes, liens, éléments de marque (bleu ardoise). */
  brand: { light: '#1F3A5F', dark: '#93C5FD', contrast: '#BFDBFE' },
  /** Preuve validée, chantier conforme. */
  ok: { light: '#15803D', dark: '#4ADE80', contrast: '#86EFAC' },
  /** Preuve à reprendre, chantier à risque. */
  warn: { light: '#A16207', dark: '#FACC15', contrast: '#FDE047' },
  /** Preuve manquante, erreur. */
  ko: { light: '#B91C1C', dark: '#F87171', contrast: '#FCA5A5' },
  /** Fond d'écran. */
  bg: { light: '#F8FAFC', dark: '#0B1220', contrast: '#000000' },
  /** Cartes, feuilles. */
  surface: { light: '#FFFFFF', dark: '#111A2E', contrast: '#121212' },
  /** Bordures et séparateurs. */
  border: { light: '#CBD5E1', dark: '#334155', contrast: '#FFFFFF' },
  /** Texte principal. */
  text: { light: '#0F172A', dark: '#F1F5F9', contrast: '#FFFFFF' },
  /** Texte secondaire. */
  'text-muted': { light: '#475569', dark: '#94A3B8', contrast: '#E5E5E5' },
} as const satisfies Record<string, TokenValues>;

export type ColorToken = keyof typeof colors;
export type Palette = Record<ColorToken, string>;

/** Palette résolue pour un mode d'affichage. */
export function palette(scheme: ColorScheme): Palette {
  return Object.fromEntries(
    Object.entries(colors).map(([token, value]) => [token, value[scheme]]),
  ) as Palette;
}

/**
 * Couleurs fixes de l'écran caméra : l'image est vue sur fond noir quel que soit le thème,
 * les commandes restent blanches et lisibles en plein soleil.
 */
export const cameraColors = {
  background: '#000000',
  ink: '#FFFFFF',
  scrim: 'rgba(0,0,0,0.55)',
  inkOnLight: '#000000',
  warn: '#FDE047',
} as const;
