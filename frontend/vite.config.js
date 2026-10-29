import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the UI calls /api and Vite forwards it to the FastAPI server.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } },
  },
});
