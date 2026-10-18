// Explicit local QA entry point. Does not read project .env files or enable providers.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tmpdir } from 'node:os';
export default defineConfig({
  plugins: [react()], envDir: tmpdir(),
  define: { 'import.meta.env.VITE_API_URL': "''", 'import.meta.env.VITE_ONESIGNAL_APP_ID': "''", 'import.meta.env.VITE_GOOGLE_CLIENT_ID': "''" },
  server: { host: '127.0.0.1', port: 5174, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:5002', changeOrigin: true } } },
});
