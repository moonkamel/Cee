import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';

/** Cap de la boussole (degrés), lu en continu pendant que la caméra est ouverte. */
export function useHeadingRef(): React.RefObject<number | null> {
  const heading = useRef<number | null>(null);
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let alive = true;
    Location.watchHeadingAsync((h) => {
      heading.current = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
    })
      .then((s) => (alive ? (sub = s) : s.remove()))
      .catch(() => undefined);
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
  return heading;
}

/** Position précise au moment de la photo, sans attendre plus de 2 s : jamais de blocage. */
export async function positionForPhoto(): Promise<{
  lat: number;
  lng: number;
  accuracyM: number | null;
} | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const last = await Location.getLastKnownPositionAsync({ maxAge: 15_000 });
    const fix =
      last ??
      (await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2_000)),
      ]));
    return fix
      ? {
          lat: fix.coords.latitude,
          lng: fix.coords.longitude,
          accuracyM: fix.coords.accuracy ?? null,
        }
      : null;
  } catch {
    return null;
  }
}
