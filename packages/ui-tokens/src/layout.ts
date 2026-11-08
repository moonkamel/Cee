// Espacements (grille de 4), rayons et tailles imposées par la section 3.

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, full: 999 } as const;

export const sizes = {
  /** Cible tactile minimale (gants) : principe n° 1. */
  touchMin: 56,
  /** Hauteur du BigButton. */
  bigButton: 64,
  /** Diamètre du ShutterButton. */
  shutter: 88,
  icon: 28,
  iconLarge: 40,
  /** Vignette d'une ProofCard. */
  thumbnail: 72,
} as const;

export const durations = {
  /** Fenêtre « Annuler » des Toast (section 3). */
  undoMs: 5000,
} as const;
