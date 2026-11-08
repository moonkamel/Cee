import { createContext, useContext, type ReactNode } from 'react';
import type { DataSource } from './types';

const DataContext = createContext<DataSource | null>(null);

export function DataProvider({ source, children }: { source: DataSource; children: ReactNode }) {
  return <DataContext.Provider value={source}>{children}</DataContext.Provider>;
}

export function useData(): DataSource {
  const source = useContext(DataContext);
  if (!source) throw new Error('useData doit être utilisé dans un DataProvider');
  return source;
}
