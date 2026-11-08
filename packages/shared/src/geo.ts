// Distances et géorepérage (sections 5 et 6).

export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_000;

/** Distance à vol d'oiseau, en mètres (formule de haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Le point est-il dans le rayon du chantier ? */
export function isWithinRadius(position: LatLng, center: LatLng, radiusMeters: number): boolean {
  return distanceMeters(position, center) <= radiusMeters;
}
