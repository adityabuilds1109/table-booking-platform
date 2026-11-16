import type { ReactNode } from 'react';
import type { CreateApiResult } from '../api';
import { ApiContext } from './apiContext';

export function ApiProvider({ value, children }: { value: CreateApiResult; children: ReactNode }) {
  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}
