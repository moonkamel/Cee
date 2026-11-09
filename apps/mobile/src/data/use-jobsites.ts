import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useData } from './data-context';
import type { CachedResult, Jobsite } from './types';

/**
 * Chantiers visibles, lus dans la base locale : affichés tout de suite, réseau ou pas,
 * et mis à jour à chaque synchronisation ou écriture locale (principe 5).
 */
export function useJobsites() {
  const data = useData();
  const [result, setResult] = useState<CachedResult<Jobsite[]> | null>(null);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setResult(await data.listJobsites());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [data]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => data.onChange(() => void refresh()), [data, refresh]);

  return { result, failed, refresh };
}
