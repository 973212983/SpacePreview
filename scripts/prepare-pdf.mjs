import { cp, mkdir } from 'node:fs/promises';
const destination = new URL('../public/pdfjs/', import.meta.url);
await mkdir(destination, { recursive: true });
for (const folder of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  await cp(
    new URL(`../node_modules/pdfjs-dist/${folder}/`, import.meta.url),
    new URL(`${folder}/`, destination),
    { recursive: true },
  );
}
