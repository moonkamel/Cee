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
  'welcome.title': 'Bienvenue sur Preuvio',
  'welcome.body': 'Photographiez vos chantiers. Preuvio guide chaque photo.',
  'welcome.start': 'Commencer',
  'login.phone.title': 'Votre numéro de portable',
  'login.phone.hint': 'Celui donné à votre entreprise',
  'login.phone.label': 'Numéro de portable',
  'login.phone.submit': 'Recevoir le code',
  'login.phone.invalid': 'Numéro incomplet',
  'login.phone.error': 'Numéro inconnu ou pas de réseau. Réessayez.',
  'login.code.title': 'Code reçu par SMS',
  'login.code.sentTo': 'Envoyé au {phone}',
  'login.code.label': 'Code à 6 chiffres',
  'login.code.error': 'Code incorrect. Réessayez.',
  'login.code.resend': 'Renvoyer le code',
  'login.code.resent': 'Nouveau code envoyé',
  'tabs.today': "Aujourd'hui",
  'tabs.jobsites': 'Chantiers',
  'tabs.me': 'Moi',
  'today.title': "Aujourd'hui",
  'today.loading': 'Recherche de vos chantiers…',
  'today.offline': 'Hors ligne · liste de {time}',
  'today.empty': "Aucun chantier prévu aujourd'hui",
  'today.newJobsite': 'Nouveau chantier',
  'today.newJobsiteSoon': 'Création de chantier : bientôt disponible',
  'today.noNetwork': 'Pas de réseau pour le moment',
  'today.retry': 'Réessayer',
  'today.others': 'Autres chantiers du jour',
  'jobsite.start': 'Commencer',
  'jobsite.open': 'Ouvrir',
  'jobsite.distance': 'à {distance}',
  'jobsite.here': 'Vous y êtes',
  'jobsite.noProofs': 'Checklist à préparer',
  'jobsite.back': 'Retour',
  'jobsite.cameraSoon': 'La caméra guidée arrive bientôt.',
  'jobsites.title': 'Mes chantiers',
  'jobsites.empty': 'Aucun chantier en cours',
  'me.title': 'Moi',
  'me.version': 'Version {version}',
  'me.signOut': 'Se déconnecter',
  'role.owner': 'Dirigeant',
  'role.admin': 'Administrateur',
  'role.office': 'Bureau',
  'role.lead': "Chef d'équipe",
  'role.installer': 'Poseur',
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
