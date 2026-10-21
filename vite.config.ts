import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Teruskan request /api ke server Express saat development.
  server: { proxy: { '/api': 'http://localhost:3001' } },
});
