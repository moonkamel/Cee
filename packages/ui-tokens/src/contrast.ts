// Calcul du rapport de contraste WCAG 2.x entre deux couleurs hexadécimales.

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`Couleur invalide : ${hex}`);
  const [r, g, b] = match.slice(1).map((h) => channel(parseInt(h, 16))) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/** Seuils utilisés par Preuvio (section 3) : AA pour le texte, 7:1 pour les actions. */
export const CONTRAST = { text: 4.5, action: 7 } as const;
