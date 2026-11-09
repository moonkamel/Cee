// Liste « À traiter » du bureau (section 14), triée par gravité, avec l'action de chaque ligne.

export type TodoKind =
  /** Photo orange de l'IA à trancher : valider ou demander une reprise. */
  | 'orange_photo'
  /** Dispense « Impossible » à valider. */
  | 'waiver'
  /** Problème signalé dans une note vocale. */
  | 'problem'
  /** Chantier terminé par le poseur avec des preuves manquantes. */
  | 'finished_incomplete'
  /** Matériel à commander, dicté par un poseur. */
  | 'material';

/** Gravité : ce qui peut coûter une prime passe d'abord. */
export const TODO_RANK: Record<TodoKind, number> = {
  orange_photo: 0,
  finished_incomplete: 1,
  waiver: 2,
  problem: 3,
  material: 4,
};

export type TodoItem = {
  kind: TodoKind;
  /** Identifiant de l'objet à traiter (preuve, chantier, élément de note). */
  id: string;
  jobsiteId: string;
  jobsiteLabel: string;
  title: string;
  detail: string | null;
  /** Date de l'événement (ISO) : le plus ancien d'abord à gravité égale. */
  since: string;
  /** La photo orange a été gardée par le poseur (« Garder quand même »). */
  keptByInstaller?: boolean;
};

export function sortTodo(items: readonly TodoItem[]): TodoItem[] {
  return [...items].sort(
    (a, b) =>
      TODO_RANK[a.kind] - TODO_RANK[b.kind] ||
      a.since.localeCompare(b.since) ||
      a.id.localeCompare(b.id),
  );
}

/** Une photo orange non tranchée depuis plus de 48 h (alerte du récapitulatif, section 10). */
export function isOverdue(item: TodoItem, nowIso: string, hours = 48): boolean {
  return (
    item.kind === 'orange_photo' && Date.parse(nowIso) - Date.parse(item.since) > hours * 3_600_000
  );
}
