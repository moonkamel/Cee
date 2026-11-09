// Écran « Aujourd'hui » (section 6) : quels chantiers, dans quel ordre, lequel ouvrir en grand.
import { distanceMeters, type LatLng } from './geo';
import type { JobsiteStatus } from './statuses';

export type TodayJobsiteInput = {
  id: string;
  status: JobsiteStatus;
  plannedStart: string | null; // AAAA-MM-JJ
  plannedEnd: string | null;
  lat: number | null;
  lng: number | null;
  geofenceRadiusM: number;
};

export type TodayJobsite<T extends TodayJobsiteInput> = T & {
  /** Distance au téléphone en mètres, ou null sans position. */
  distanceM: number | null;
  /** Le téléphone est dans le rayon du chantier. */
  insideGeofence: boolean;
};

/** Un chantier est « du jour » s'il est en cours, ou planifié et prévu aujourd'hui. */
export function isTodayJobsite(j: TodayJobsiteInput, today: string): boolean {
  if (j.status === 'in_progress') return true;
  if (j.status !== 'planned' || !j.plannedStart) return false;
  const end = j.plannedEnd ?? j.plannedStart;
  return j.plannedStart <= today && today <= end;
}

/**
 * Chantiers du jour, le plus proche en tête quand la position est connue,
 * sinon par date de début puis par identifiant (ordre stable).
 */
export function selectTodayJobsites<T extends TodayJobsiteInput>(
  jobsites: readonly T[],
  today: string,
  position: LatLng | null,
): TodayJobsite<T>[] {
  return jobsites
    .filter((j) => isTodayJobsite(j, today))
    .map((j) => {
      const distanceM =
        position && j.lat !== null && j.lng !== null
          ? distanceMeters(position, { lat: j.lat, lng: j.lng })
          : null;
      return {
        ...j,
        distanceM,
        insideGeofence: distanceM !== null && distanceM <= j.geofenceRadiusM,
      };
    })
    .sort((a, b) => {
      if (a.distanceM !== null || b.distanceM !== null) {
        if (a.distanceM === null) return 1;
        if (b.distanceM === null) return -1;
        if (a.distanceM !== b.distanceM) return a.distanceM - b.distanceM;
      }
      const byDate = (a.plannedStart ?? '').localeCompare(b.plannedStart ?? '');
      return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
    });
}

/**
 * Le chantier à afficher en grand : celui dans le rayon duquel se trouve le téléphone,
 * ou le seul chantier du jour. Sinon aucun : la liste suffit.
 */
export function featuredJobsite<T extends TodayJobsiteInput>(
  today: readonly TodayJobsite<T>[],
): TodayJobsite<T> | null {
  return today.find((j) => j.insideGeofence) ?? (today.length === 1 ? (today[0] ?? null) : null);
}
