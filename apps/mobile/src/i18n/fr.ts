// Textes d'interface en français. Les autres langues (V2) reprendront ces clés.
// Consignes : 8 mots maximum, vocabulaire du métier, vouvoiement.

export const fr = {
  'app.tagline': 'La preuve de pose, sans taper un mot.',
  'status.ok': 'Validée',
  'status.warn': 'À reprendre',
  'status.ko': 'Manquante',
  'status.pending': 'En analyse',
  'status.waived': 'Dispensée',
  'shutter.label': 'Prendre la photo',
  'voice.hold': 'Maintenez pour parler',
  'voice.recording': 'Enregistrement… relâchez pour finir',
  'progress.label': '{done} sur {total} preuves',
  'toast.undo': 'Annuler',
  'checklist.photograph': 'Photographier : {label}',
  'catalogue.title': 'Catalogue des composants',
  'catalogue.open': 'Ouvrir le catalogue',
  'scheme.light': 'Clair',
  'scheme.dark': 'Sombre',
  'scheme.contrast': 'Contraste max',
} as const;

export type TranslationKey = keyof typeof fr;

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  let text: string = fr[key];
  for (const [name, value] of Object.entries(params ?? {})) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}
