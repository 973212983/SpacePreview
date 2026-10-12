import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

const destination = new URL('../public/engines/', import.meta.url);
await mkdir(destination, { recursive: true });
for (const [source, name] of [
  ['libarchive.js/dist/libarchive.wasm', 'libarchive.wasm'],
  ['@imagemagick/magick-wasm/dist/x86/magick.wasm', 'magick.wasm'],
  ['sql.js/dist/sql-wasm.wasm', 'sql-wasm.wasm'],
  ['occt-import-js/dist/occt-import-js.wasm', 'occt-import-js.wasm'],
  ['assimpjs/dist/assimpjs.wasm', 'assimpjs.wasm'],
]) {
  await cp(new URL(`../node_modules/${source}`, import.meta.url), new URL(name, destination));
}

// libarchive.js 2.0.2 treats an archive_read failure as an empty directory.
// Surface libarchive's error after directory iteration, including corrupt files.
const archiveWorker = await readFile(
  new URL('../node_modules/libarchive.js/dist/worker-bundle.js', import.meta.url),
  'utf8',
);
const marker = 'yield n}}async _loadFile';
if (archiveWorker.split(marker).length !== 2)
  throw new Error('libarchive worker changed; revalidate its error-reporting patch.');
await writeFile(
  new URL('archive-worker.js', destination),
  archiveWorker.replace(
    marker,
    'yield n}const failure=this._runCode.getError(this._archive);if(failure)throw new Error(failure)}async _loadFile',
  ),
  'utf8',
);

// Keep the original license/NOTICE texts next to the engines in every build.
const licenses = new URL('licenses/', destination);
await mkdir(licenses, { recursive: true });
const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
const manifest = [];
for (const [path, metadata] of Object.entries(lock.packages)) {
  if (!path.startsWith('node_modules/') || metadata.dev) continue;
  const directory = new URL(`../${path}/`, import.meta.url);
  let pkg, files;
  try {
    pkg = JSON.parse(await readFile(new URL('package.json', directory), 'utf8'));
    files = await readdir(directory);
  } catch {
    continue;
  } // Optional platform packages may be absent on this host.
  const output = new URL(`${path.replaceAll('/', '__')}/`, licenses);
  await mkdir(output, { recursive: true });
  const notices = files.filter((file) => /^(?:licen[cs]e|notice|copying)(?:[._-]|$)/i.test(file));
  for (const file of notices)
    await cp(new URL(file, directory), new URL(file, output), { recursive: true });
  if (['occt-import-js', 'assimpjs'].includes(pkg.name)) {
    for (const file of await readdir(new URL('dist/', directory))) {
      if (/^license\./i.test(file)) {
        await cp(new URL(`dist/${file}`, directory), new URL(file, output));
        notices.push(file);
      }
    }
  }
  manifest.push({
    name: pkg.name,
    version: pkg.version,
    license: pkg.license,
    repository: pkg.repository,
    files: notices.map((file) => `${path.replaceAll('/', '__')}/${file}`),
  });
}
await cp(
  new URL('../docs/licenses/libarchive-COPYING.txt', import.meta.url),
  new URL('libarchive-COPYING.txt', licenses),
);
await cp(
  new URL('../docs/licenses/viz-js-LICENSE.txt', import.meta.url),
  new URL('viz-js-LICENSE.txt', licenses),
);
await cp(
  new URL('../docs/licenses/graphviz-LICENSE.txt', import.meta.url),
  new URL('graphviz-LICENSE.txt', licenses),
);
await cp(
  new URL('../docs/licenses/xz-decompress-NOTICE.txt', import.meta.url),
  new URL('xz-decompress-NOTICE.txt', licenses),
);
await cp(
  new URL('../docs/licenses/walloc-LICENSE.txt', import.meta.url),
  new URL('walloc-LICENSE.txt', licenses),
);
await cp(
  new URL('../THIRD-PARTY-NOTICES.md', import.meta.url),
  new URL('THIRD-PARTY-NOTICES.md', licenses),
);
await writeFile(new URL('index.json', licenses), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
