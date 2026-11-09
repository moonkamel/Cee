import { useEffect, useState } from 'react';
import { useData } from './data-context';
import type { PhotoRequest } from './types';

/** Demandes de reprise ouvertes pour ce poseur, à jour après chaque synchronisation. */
export function usePhotoRequests(jobsiteId?: string): PhotoRequest[] {
  const data = useData();
  const [requests, setRequests] = useState<PhotoRequest[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () =>
      void data.listPhotoRequests(jobsiteId).then(
        (r) => {
          if (alive) setRequests(r);
        },
        () => undefined,
      );
    load();
    const unsubscribe = data.onChange(load);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [data, jobsiteId]);
  return requests;
}
