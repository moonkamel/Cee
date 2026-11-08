import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useData } from './data-context';
import type { CachedResult, Jobsite } from './types';

/**
 * Chantiers visibles : la dernière liste connue s'affiche tout de suite, puis se met à jour.
 * Aucun écran de chargement bloquant (principe 5).
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
      let alive = true;
      void data.cachedJobsites().then((cached) => {
        if (alive && cached) setResult((current) => current ?? cached);
      });
      void refresh();
      return () => {
        alive = false;
      };
    }, [data, refresh]),
  );

  return { result, failed, refresh };
}
