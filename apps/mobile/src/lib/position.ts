import type { LatLng } from '@preuvio/shared';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

/**
 * Position actuelle, demandée au moment où elle sert (section 15).
 * Le message système (app.json) explique en une phrase pourquoi.
 * Refus ou échec : null, et l'écran trie sans la position — jamais de blocage.
 */
export function useCurrentPosition(): LatLng | null {
  const [position, setPosition] = useState<LatLng | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const last = await Location.getLastKnownPositionAsync();
        if (last && alive) setPosition({ lat: last.coords.latitude, lng: last.coords.longitude });
        const fresh = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (alive) setPosition({ lat: fresh.coords.latitude, lng: fresh.coords.longitude });
      } catch {
        // Pas de GPS : on continue sans.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return position;
}

/** Date du jour au format AAAA-MM-JJ, en heure locale du téléphone. */
export function localToday(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
