import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'));
const buildTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(`v${version} (built ${buildTime} UTC)`)
  },
  base: './',
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  }
});
