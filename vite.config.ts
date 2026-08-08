/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
// @ts-expect-error The project intentionally does not install the full Node type package.
import { readFile } from 'node:fs/promises';

const APP_BASE_PATH = '/mask-unmask';

function previewAppRoutes(): Plugin {
  return {
    name: 'preview-app-routes',
    configurePreviewServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const previewRequest = request as typeof request & { url?: string };
        const pathname = new URL(previewRequest.url ?? '/', 'http://localhost').pathname;
        if (pathname === '/' || pathname === '/index.html') {
          response.statusCode = 200;
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          response.end(await readFile(new URL('./dist/index.html', import.meta.url)));
          return;
        }

        if (pathname === '/circle-note.css') {
          response.statusCode = 200;
          response.setHeader('Content-Type', 'text/css; charset=utf-8');
          response.end(await readFile(new URL('./dist/circle-note.css', import.meta.url)));
          return;
        }

        if (pathname === APP_BASE_PATH) {
          response.statusCode = 301;
          response.setHeader('Location', `${APP_BASE_PATH}/`);
          response.end();
          return;
        }

        if (pathname.startsWith(`${APP_BASE_PATH}/`) && !pathname.split('/').pop()?.includes('.')) {
          previewRequest.url = `${APP_BASE_PATH}/index.html`;
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: `${APP_BASE_PATH}/`,
  plugins: [previewAppRoutes(), react()],
  build: {
    outDir: 'dist/mask-unmask',
    emptyOutDir: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', 'tests/e2e/**'],
  },
});
