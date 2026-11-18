import { defineConfig } from 'vite';

export default defineConfig({
  appType: 'spa',
  build: { target: 'esnext' },
  server: { host: '127.0.0.1', port: 4173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
});
