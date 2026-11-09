// Adresses : Base Adresse Nationale via le service de géocodage de l'IGN (Géoplateforme),
// public et sans clé. Réponse GeoJSON : features[].properties.label / id,
// geometry.coordinates = [longitude, latitude].

export const GEOCODING_BASE_URL = 'https://data.geopf.fr/geocodage';

export type AddressSuggestion = {
  label: string;
  banId: string | null;
  lat: number;
  lng: number;
};

export function reverseGeocodeUrl(lat: number, lng: number, limit = 5): string {
  return `${GEOCODING_BASE_URL}/reverse?index=address&lat=${lat}&lon=${lng}&limit=${limit}`;
}

export function searchAddressUrl(
  query: string,
  near?: { lat: number; lng: number },
  limit = 5,
): string {
  const params = new URLSearchParams({ index: 'address', q: query, limit: String(limit) });
  if (near) {
    params.set('lat', String(near.lat));
    params.set('lon', String(near.lng));
  }
  return `${GEOCODING_BASE_URL}/search?${params.toString()}`;
}

/** Lit une réponse GeoJSON du géocodeur ; ignore toute entrée incomplète. */
export function parseGeocodingResponse(body: unknown): AddressSuggestion[] {
  const features = (body as { features?: unknown })?.features;
  if (!Array.isArray(features)) return [];
  const out: AddressSuggestion[] = [];
  for (const f of features) {
    const props = (f as { properties?: Record<string, unknown> }).properties ?? {};
    const coords = (f as { geometry?: { coordinates?: unknown } }).geometry?.coordinates;
    const label = typeof props.label === 'string' ? props.label.trim() : '';
    if (
      !label ||
      !Array.isArray(coords) ||
      typeof coords[0] !== 'number' ||
      typeof coords[1] !== 'number'
    ) {
      continue;
    }
    out.push({
      label,
      banId: typeof props.id === 'string' ? props.id : null,
      lng: coords[0],
      lat: coords[1],
    });
  }
  return out;
}

/** Adresse provisoire quand le réseau manque : la position est gardée, l'adresse viendra. */
export function pendingAddressLabel(lat: number, lng: number): string {
  const f = (n: number) => n.toFixed(4).replace('.', ',');
  return `Position GPS ${f(lat)} ; ${f(lng)} — adresse à compléter`;
}
