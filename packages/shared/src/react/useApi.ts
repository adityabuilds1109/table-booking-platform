import { useContext } from 'react';
import type { Endpoints } from '../api';
import { ApiContext } from './apiContext';

export function useApi(): Endpoints {
  const value = useContext(ApiContext);
  if (value === null) {
    throw new Error('useApi must be used inside <ApiProvider>');
  }
  return value.api;
}
