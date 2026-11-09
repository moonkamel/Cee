// Modèles globaux de checklists, maintenus par Preuvio (section 7), en JSON versionné.
// Contenu à faire relire par un professionnel du métier avant usage réel : tant que
// `review.status` vaut « draft », l'appli et le bureau l'affichent comme brouillon.
import combles from './global/combles-perdus.json' with { type: 'json' };
import pacAirEau from './global/pac-air-eau.json' with { type: 'json' };

/** Modèles globaux, bruts : à valider par `parseTemplate` de @preuvio/shared. */
export const globalTemplates: readonly unknown[] = [pacAirEau, combles];
