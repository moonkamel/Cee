import { useEffect, useState } from 'react';
import { useData } from './data-context';
import type { PhotoSummary, ProofSlot } from './types';

/** Preuves attendues et photos d'un chantier, à jour après chaque photo ou synchronisation. */
export function useProofs(jobsiteId: string) {
  const data = useData();
  const [slots, setSlots] = useState<ProofSlot[] | null>(null);
  const [photos, setPhotos] = useState<PhotoSummary[]>([]);

  useEffect(() => {
    let alive = true;
    const load = () =>
      void Promise.all([data.listSlots(jobsiteId), data.listPhotos(jobsiteId)]).then(([s, p]) => {
        if (!alive) return;
        setSlots(s);
        setPhotos(p);
      });
    load();
    const unsubscribe = data.onChange(load);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [data, jobsiteId]);

  return { slots, photos };
}
