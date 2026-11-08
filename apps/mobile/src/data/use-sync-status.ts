import type { SyncStatus } from '@preuvio/shared';
import { useEffect, useState } from 'react';
import { useData } from './data-context';

export function useSyncStatus(): SyncStatus | null {
  const data = useData();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  useEffect(() => {
    const load = () => void data.syncStatus().then(setStatus, () => undefined);
    load();
    return data.onChange(load);
  }, [data]);
  return status;
}
