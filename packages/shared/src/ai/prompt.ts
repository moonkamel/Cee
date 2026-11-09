// Consigne envoyée à l'IA pour une photo de preuve (section 8).
import type { ExtractField } from './verdict';

/** Contrôles connus des modèles (`ai_checks`), décrits pour l'IA. `subject:x` : sujet visible. */
const CHECKS: Record<string, string> = {
  sharp: 'la photo est nette (pas de flou ni de bougé)',
  well_lit: 'la photo est assez éclairée pour voir les détails',
  plate_readable: 'la plaque ou l’étiquette est entièrement lisible (pas de reflet, pas coupée)',
  screen_readable: 'l’écran est allumé et son affichage est lisible',
  document_readable: 'le document est entier et lisible',
  ruler_readable: 'la règle graduée est visible et ses graduations sont lisibles',
};

const SUBJECTS: Record<string, string> = {
  boiler: 'une chaudière',
  heat_pump_outdoor: 'l’unité extérieure d’une pompe à chaleur',
};

export function describeCheck(id: string): string {
  if (id.startsWith('subject:')) {
    const subject = id.slice('subject:'.length);
    return `on voit bien ${SUBJECTS[subject] ?? subject.replaceAll('_', ' ')}`;
  }
  return CHECKS[id] ?? id.replaceAll('_', ' ');
}

export const SYSTEM_PROMPT = [
  'Tu contrôles des photos de chantier prises par des poseurs (rénovation énergétique, France).',
  'Chaque photo doit prouver un point précis d’un dossier de certificats d’économies d’énergie.',
  'Tu signales un défaut visible ; tu ne bloques rien et tu ne déclares jamais un chantier conforme.',
  'Pour chaque contrôle demandé, dis s’il est réussi, avec ta confiance entre 0 et 1 et une raison brève.',
  'status : « ok » si tout est réussi, « warn » si un défaut gêne la preuve, « fail » si la photo ne montre pas le sujet.',
  'user_message : un conseil au poseur en français, 8 mots au plus, à l’impératif (ex. « Plaque illisible, rapprochez-vous »). Vide si status est « ok ».',
  'extracted : recopie seulement ce qui est lisible sur la photo ; null sinon. N’invente jamais une valeur.',
  'Ignore les personnes : ne décris ni n’identifie jamais un visage.',
].join('\n');

export type PhotoTask = {
  /** Consigne de la preuve, telle que le poseur l'a lue (« Plaque de l'unité extérieure »). */
  instruction: string;
  hint?: string | null;
  checks: string[];
  extract: ExtractField[];
};

export function buildUserPrompt(task: PhotoTask): string {
  const lines = [
    `Preuve attendue : ${task.instruction}${task.hint ? ` (${task.hint})` : ''}.`,
    'Contrôles demandés :',
    ...task.checks.map((id) => `- ${id} : ${describeCheck(id)}`),
  ];
  if (task.extract.length > 0) lines.push(`Données à lire : ${task.extract.join(', ')}.`);
  return lines.join('\n');
}
