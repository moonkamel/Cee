import { useEffect, useState } from 'react';
import { useData } from './data-context';
import type { AppSyncStatus } from './types';

export function useSyncStatus(): AppSyncStatus | null {
  const data = useData();
  const [status, setStatus] = useState<AppSyncStatus | null>(null);
  useEffect(() => {
    const load = () => void data.syncStatus().then(setStatus, () => undefined);
    load();
    return data.onChange(load);
  }, [data]);
  return status;
}
