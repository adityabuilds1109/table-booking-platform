import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { createApi } from '@table-booking/shared/api';
import { ApiProvider } from '@table-booking/shared/react';
import App from './App';
import { AuthProvider } from './auth/AuthProvider';
import { tokenStore } from './auth/tokenStore';
import { env } from './lib/env';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

// Created once here and handed down through <ApiProvider>. The token is forgotten (tokenStore.clear) before the app is told
// the session ended (see AuthProvider).
const apiHandle = createApi({ baseUrl: env.apiUrl, getToken: tokenStore.get, onUnauthorized: tokenStore.clear });

createRoot(rootElement).render(
  <StrictMode>
    <ApiProvider value={apiHandle}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ApiProvider>
  </StrictMode>,
);
