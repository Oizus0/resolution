import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
// Owlbear resolves leading-slash manifest URLs from the hosting origin.
// Use the same deployment directory for every manifest entry and Vite asset.
const base = process.env.INITIATIVE_BASE_PATH || '/';
if (!base.startsWith('/') || !base.endsWith('/') || base.includes('..')) {
  throw new Error('INITIATIVE_BASE_PATH deve ser / ou /nome-do-repositorio/.');
}
export default defineConfig({
  base,
  plugins: [{ name: 'extension-manifest', closeBundle() {
    const path = resolve(import.meta.dirname, 'dist/manifest.json');
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    manifest.icon = `${base}icon.svg`;
    manifest.action.icon = `${base}toolbar.svg`;
    manifest.action.popover = `${base}index.html`;
    manifest.background_url = `${base}background.html`;
    writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
  } }],
  build: { rollupOptions: { input: {
    main: resolve(import.meta.dirname, 'index.html'),
    background: resolve(import.meta.dirname, 'background.html')
  } } },
  server: { port: 5173, strictPort: true, cors: true },
  preview: { port: 4173, strictPort: true, cors: true }
});
