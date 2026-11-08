// Numéros de téléphone français : saisie libre → format international E.164 (+33…).

/** Renvoie le numéro au format +33XXXXXXXXX, ou null s'il n'est pas valide. */
export function normalizeFrenchPhone(input: string): string | null {
  const digits = input.replace(/[\s.\-()]/g, '');
  let national: string | null = null;
  if (/^0[1-9]\d{8}$/.test(digits)) national = digits.slice(1);
  else if (/^\+33[1-9]\d{8}$/.test(digits)) national = digits.slice(3);
  else if (/^0033[1-9]\d{8}$/.test(digits)) national = digits.slice(4);
  return national ? `+33${national}` : null;
}

/** Affichage lisible : +33639980003 → 06 39 98 00 03. */
export function formatFrenchPhone(e164: string): string {
  const normalized = normalizeFrenchPhone(e164);
  if (!normalized) return e164;
  return `0${normalized.slice(3)}`.replace(/(\d{2})(?=\d)/g, '$1 ');
}
