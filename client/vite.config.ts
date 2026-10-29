import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // If 5173 is taken, fail instead of silently moving to 5174: the API's CORS allow-list (CORS_ORIGINS) names 5173,
    // so any other port would make every request fail with a confusing CORS error.
    strictPort: true,
  },
});
