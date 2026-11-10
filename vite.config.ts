/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
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

        if (pathname === '/robots.txt') {
          response.statusCode = 200;
          response.setHeader('Content-Type', 'text/plain; charset=utf-8');
          response.end(await readFile(new URL('./dist/robots.txt', import.meta.url)));
          return;
        }

        if (pathname === '/sitemap.xml') {
          response.statusCode = 200;
          response.setHeader('Content-Type', 'application/xml; charset=utf-8');
          response.end(await readFile(new URL('./dist/sitemap.xml', import.meta.url)));
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

// Record third-party modules that Rollup actually included in generated JS chunks.
// Do not publish absolute source paths or file contents in the provenance report.
function bundleProvenance(): Plugin {
  return {
    name: 'mask-unmask-bundle-provenance',
    apply: 'build',
    async generateBundle(_options, bundle) {
      const lock = JSON.parse(await readFile(new URL('./package-lock.json', import.meta.url), 'utf8')) as {
        packages: Record<string, { version?: string; license?: string; dev?: boolean }>;
      };
      const packages = new Map<string, { name: string; version: string | null; license: string | null; development: boolean; moduleCount: number }>();
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        for (const id of Object.keys(output.modules)) {
          const normalized = id.split(String.fromCharCode(92)).join('/');
          const nodeModulesIndex = normalized.lastIndexOf('/node_modules/');
          if (nodeModulesIndex < 0) continue;
          const parts = normalized.slice(nodeModulesIndex + '/node_modules/'.length).split('/');
          const name = parts[0]?.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
          if (!name) continue;
          const metadata = lock.packages[`node_modules/${name}`];
          if (!metadata) {
            throw new Error(`Bundled dependency not found in lockfile: ${name}`);
          }
          const prev = packages.get(name);
          if (prev) prev.moduleCount++;
          else packages.set(name, {
            name, version: metadata.version ?? null, license: metadata.license ?? null,
            development: metadata.dev === true, moduleCount: 1,
          });
        }
      }
      const result = [...packages.values()].sort((a, b) => a.name.localeCompare(b.name));
      if (result.length === 0) throw new Error('No bundled third-party modules detected');
      const unknown = result.filter((item) => !item.license || item.development || item.license !== 'MIT');
      if (unknown.length) {
        throw new Error(`Bundled dependencies require explicit license review: ${unknown.map((item) => `${item.name}@${item.version} [${item.license ?? 'UNKNOWN'}; dev=${item.development}]`).join(', ')}`);
      }
      this.emitFile({
        type: 'asset',
        fileName: 'bundle-provenance.json',
        source: JSON.stringify({
          source: 'Rollup output chunk module IDs and package-lock metadata; not a legal conclusion',
          packages: result,
        }, null, 2) + '\\n',
      });
      console.log(`Bundled third-party dependency origins: ${result.map((item) => `${item.name}@${item.version}`).join(', ')}`);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: `${APP_BASE_PATH}/`,
  plugins: [previewAppRoutes(), react(), bundleProvenance()],
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
