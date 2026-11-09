// Typographie de la section 3 : Atkinson Hyperlegible, Inter en secours, rien sous 16.

export const fontFamily = {
  regular: 'AtkinsonHyperlegible_400Regular',
  bold: 'AtkinsonHyperlegible_700Bold',
  /** Pile CSS pour le web. */
  web: "'Atkinson Hyperlegible', Inter, ui-sans-serif, system-ui, sans-serif",
} as const;

export const MIN_FONT_SIZE = 16;

export const typography = {
  display: { fontSize: 32, lineHeight: 40, weight: 'bold' },
  title: { fontSize: 24, lineHeight: 32, weight: 'bold' },
  button: { fontSize: 20, lineHeight: 26, weight: 'bold' },
  body: { fontSize: 18, lineHeight: 26, weight: 'regular' },
  caption: { fontSize: 16, lineHeight: 22, weight: 'regular' },
} as const satisfies Record<
  string,
  { fontSize: number; lineHeight: number; weight: 'regular' | 'bold' }
>;

export type TypographyVariant = keyof typeof typography;
