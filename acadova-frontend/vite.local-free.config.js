// Explicit isolated local development only. Never load normal project .env files.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tmpdir } from 'node:os';
export default defineConfig({
  plugins: [react()], envDir: tmpdir(),
  define: { 'import.meta.env.VITE_API_URL': "''", 'import.meta.env.VITE_ONESIGNAL_APP_ID': "''", 'import.meta.env.VITE_GOOGLE_CLIENT_ID': "''" },
  server: {host:'localhost',port:5173,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:5004',changeOrigin:true}}},
});
