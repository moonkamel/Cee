import { useEffect, useState } from 'react';
import { useData } from './data-context';
import type { Operation } from './types';

/** Opérations du chantier et leurs questions rapides, à jour après chaque réponse. */
export function useOperations(jobsiteId: string): Operation[] {
  const data = useData();
  const [operations, setOperations] = useState<Operation[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () =>
      void data.listOperations(jobsiteId).then(
        (o) => {
          if (alive) setOperations(o);
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
  return operations;
}
