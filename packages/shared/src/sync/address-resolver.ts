import type { AddressSuggestion } from './address';
import type { SyncEngine } from './engine';

/**
 * Chantiers créés hors ligne avec une simple position GPS : au retour du réseau, on demande
 * l'adresse au géocodeur et on l'envoie comme une modification ordinaire.
 * Renvoie le nombre d'adresses complétées. Un échec laisse le chantier en attente.
 */
export async function resolvePendingAddresses(
  engine: Pick<SyncEngine, 'rows' | 'write'>,
  reverseGeocode: (lat: number, lng: number) => Promise<AddressSuggestion | null>,
): Promise<number> {
  let resolved = 0;
  for (const jobsite of await engine.rows('jobsites')) {
    if (jobsite._addressPending !== true) continue;
    const { lat, lng } = jobsite;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    let found: AddressSuggestion | null = null;
    try {
      found = await reverseGeocode(lat, lng);
    } catch {
      continue;
    }
    if (!found) continue;
    await engine.write('jobsites', 'update', {
      id: jobsite.id,
      address: found.label,
      ban_id: found.banId,
      _addressPending: false,
    });
    resolved += 1;
  }
  return resolved;
}
