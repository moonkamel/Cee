import { useEffect, useState } from 'react';
import { useData } from './data-context';
import type { VoiceNote } from './types';

/** Notes vocales d'un chantier, à jour après chaque enregistrement ou synchronisation. */
export function useVoiceNotes(jobsiteId: string): VoiceNote[] {
  const data = useData();
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () =>
      void data.listVoiceNotes(jobsiteId).then(
        (n) => {
          if (alive) setNotes(n);
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
  return notes;
}
