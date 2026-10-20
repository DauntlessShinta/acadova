// Explicit local QA entry point. Does not read project .env files or enable providers.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tmpdir } from 'node:os';
const growthPreview = process.env.ACADOVA_GROWTH_HEADER_PREVIEW === '1';
const staffMfaPreview = process.env.ACADOVA_STAFF_MFA_PREVIEW === '1';
if (growthPreview && staffMfaPreview) throw new Error('Choose only one isolated QA preview.');
export default defineConfig({
  plugins: [react()], envDir: tmpdir(),
  define: { 'import.meta.env.VITE_API_URL': "''", 'import.meta.env.VITE_ONESIGNAL_APP_ID': "''", 'import.meta.env.VITE_GOOGLE_CLIENT_ID': "''" },
  server: { host: '127.0.0.1', port: staffMfaPreview ? 5178 : growthPreview ? 5176 : 5174, strictPort: true, proxy: { '/api': { target: staffMfaPreview ? 'http://127.0.0.1:5006' : growthPreview ? 'http://127.0.0.1:5004' : 'http://127.0.0.1:5002', changeOrigin: true } } },
});
