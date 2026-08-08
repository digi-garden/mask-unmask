import { copyFile, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(repositoryRoot, 'dist');
const appOutput = resolve(outputRoot, 'mask-unmask');

await mkdir(outputRoot, { recursive: true });
await copyFile(resolve(repositoryRoot, 'circle-note/index.html'), resolve(outputRoot, 'index.html'));
await copyFile(resolve(repositoryRoot, 'circle-note/circle-note.css'), resolve(outputRoot, 'circle-note.css'));

await rm(resolve(outputRoot, '_headers'), { force: true });
await rename(resolve(appOutput, '_headers'), resolve(outputRoot, '_headers'));

await writeFile(
  resolve(outputRoot, '_redirects'),
  [
    '/mask-unmask /mask-unmask/ 301',
    '/mask-unmask/assets/* /mask-unmask/assets/:splat 200',
    '/mask-unmask/favicon.svg /mask-unmask/favicon.svg 200',
    '/mask-unmask/favicon-32.png /mask-unmask/favicon-32.png 200',
    '/mask-unmask/apple-touch-icon.png /mask-unmask/apple-touch-icon.png 200',
    '/mask-unmask/digi-garden-logo.svg /mask-unmask/digi-garden-logo.svg 200',
    '/mask-unmask/* /mask-unmask/index.html 200',
    '',
  ].join('\n'),
  'utf8',
);
