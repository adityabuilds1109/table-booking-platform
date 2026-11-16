import { useContext } from 'react';
import type { CreateApiResult } from '../api';
import { ApiContext } from './apiContext';

// What the app should do when the server says the session is no longer valid (see createApi). The AuthProvider sets it.
export function useSessionExpiredHandler(): CreateApiResult['setSessionExpiredHandler'] {
  const value = useContext(ApiContext);
  if (value === null) {
    throw new Error('useSessionExpiredHandler must be used inside <ApiProvider>');
  }
  return value.setSessionExpiredHandler;
}
