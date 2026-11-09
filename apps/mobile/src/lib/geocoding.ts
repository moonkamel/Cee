import {
  parseGeocodingResponse,
  reverseGeocodeUrl,
  searchAddressUrl,
  type AddressSuggestion,
} from '@preuvio/shared';

// Base Adresse Nationale (service public, sans clé) : appel direct, aucune donnée sensible
// envoyée hormis la position ou le texte cherché.
const TIMEOUT_MS = 6_000;

async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Géocodeur : HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Adresses autour d'une position, la plus proche en tête. Lève une erreur hors ligne. */
export async function addressesNear(lat: number, lng: number): Promise<AddressSuggestion[]> {
  return parseGeocodingResponse(await getJson(reverseGeocodeUrl(lat, lng)));
}

export async function searchAddresses(
  query: string,
  near?: { lat: number; lng: number },
): Promise<AddressSuggestion[]> {
  if (query.trim().length < 3) return [];
  return parseGeocodingResponse(await getJson(searchAddressUrl(query, near)));
}

export async function nearestAddress(lat: number, lng: number): Promise<AddressSuggestion | null> {
  return (await addressesNear(lat, lng))[0] ?? null;
}
