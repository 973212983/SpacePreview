import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { buffer: 'buffer/' } },
  build: { target: ['es2021', 'safari15.4'] },
  server: { port: 1420, strictPort: true },
  clearScreen: false,
  worker: {
    format: 'es',
    plugins: () => [
      {
        name: 'preserve-pdf-worker-exports',
        // PDF.js imports this module when a WebView cannot start a real Worker.
        options: (options) =>
          typeof options.input === 'string' && options.input.endsWith('pdf.worker.ts')
            ? { ...options, preserveEntrySignatures: 'strict' }
            : options,
      },
    ],
  },
});
