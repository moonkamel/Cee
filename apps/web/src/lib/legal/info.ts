// Informations légales de l'éditeur (section 16). Les champs « à compléter » sont à remplir
// avant le lancement commercial ; tous les textes sont à faire relire par un juriste.
export const EDITOR = {
  name: 'Preuvio',
  legalForm: '[forme juridique à compléter]',
  capital: '[capital à compléter]',
  siren: '[SIREN à compléter]',
  address: '[adresse du siège à compléter]',
  director: '[directeur de la publication à compléter]',
  contact: '[adresse e-mail de contact à compléter]',
  dpo: '[contact données personnelles à compléter]',
};

export const UPDATED = '10 novembre 2026';

/** Sous-traitants ultérieurs (section 16) : rôle, localisation, garanties. */
export const SUBPROCESSORS = [
  {
    name: 'Supabase',
    role: 'Base de données, fichiers (photos, PDF), authentification, fonctions serveur',
    location: 'Union européenne (Paris, eu-west-3)',
    safeguards: 'Hébergement dans l’UE ; société américaine : clauses contractuelles types',
  },
  {
    name: 'Vercel',
    role: 'Hébergement du tableau de bord web',
    location: 'Union européenne (Paris, cdg1) ; réseau mondial de diffusion',
    safeguards: 'Clauses contractuelles types, Data Privacy Framework',
  },
  {
    name: 'Anthropic',
    role: 'Pré-contrôle des photos, rédaction des rapports, contenus marketing (IA)',
    location: 'États-Unis',
    safeguards:
      'Clauses contractuelles types ; données transmises limitées aux photos et faits du chantier, sans nom ni coordonnées du client ; pas d’entraînement sur vos données',
  },
  {
    name: 'Mistral AI',
    role: 'Transcription des notes vocales',
    location: 'Union européenne (France)',
    safeguards: 'Hébergement dans l’UE',
  },
  {
    name: 'Brevo',
    role: 'Envoi des SMS et e-mails (codes, invitations, liens client)',
    location: 'Union européenne (France)',
    safeguards: 'Hébergement dans l’UE',
  },
  {
    name: 'Stripe',
    role: 'Paiement de l’abonnement et factures',
    location: 'Union européenne (Irlande) et États-Unis',
    safeguards: 'Clauses contractuelles types, Data Privacy Framework',
  },
  {
    name: 'Sentry',
    role: 'Suivi des plantages et des performances',
    location: 'Union européenne (Allemagne)',
    safeguards: 'Hébergement dans l’UE ; société américaine : clauses contractuelles types',
  },
  {
    name: 'PostHog',
    role: 'Mesure d’usage de l’application (sans enregistrement de session)',
    location: 'Union européenne (Allemagne)',
    safeguards: 'Hébergement dans l’UE',
  },
  {
    name: 'IGN (Géoplateforme) et Base Adresse Nationale',
    role: 'Fonds de carte et recherche d’adresses',
    location: 'France',
    safeguards: 'Services publics français ; aucune donnée de compte transmise',
  },
] as const;
