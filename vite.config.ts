import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Firebase is intentionally isolated; its minified chunk is ~521 kB but
      // compresses to ~121 kB. Keep the warning threshold just above that
      // known vendor chunk while still flagging unexpected bundle growth.
      chunkSizeWarningLimit: 550,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('firebase')) return 'firebase';
            if (id.includes('recharts') || id.includes('/d3-')) return 'charts';
            if (
              id.includes('xlsx') ||
              id.includes('jszip') ||
              id.includes('papaparse')
            ) {
              return 'data-tools';
            }
            if (id.includes('framer-motion') || id.includes('/motion/')) {
              return 'motion';
            }
            if (
              id.includes('react-dom') ||
              id.includes('/react/') ||
              id.includes('/scheduler/') ||
              id.includes('/react-is/') ||
              id.includes('/use-sync-external-store/')
            ) {
              return 'react';
            }
            return 'vendor';
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
