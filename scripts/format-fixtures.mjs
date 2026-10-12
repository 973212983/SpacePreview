import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { Archive, ArchiveFormat, ArchiveCompression } from 'libarchive.js/dist/libarchive-node.mjs';
import {
  initializeImageMagick,
  ImageMagick,
  MagickFormat,
  MagickColors,
} from '@imagemagick/magick-wasm';
import initSqlJs from 'sql.js';
import { gzipSync, strToU8 } from 'fflate';
import { Worker } from 'node:worker_threads';

Archive.init({
  getWorker: () => {
    const worker = new Worker(
      new URL('../node_modules/libarchive.js/dist/worker-bundle-node.mjs', import.meta.url),
    );
    const callbacks = new Map();
    return {
      postMessage: worker.postMessage.bind(worker),
      terminate: worker.terminate.bind(worker),
      addEventListener(type, callback) {
        const wrapped = (data) => callback({ data });
        callbacks.set(callback, wrapped);
        worker.on(type, wrapped);
      },
      removeEventListener(type, callback) {
        worker.off(type, callbacks.get(callback));
        callbacks.delete(callback);
      },
    };
  },
});

const destination = new URL('../test-results/fixtures/', import.meta.url);
await mkdir(destination, { recursive: true });
await initializeImageMagick(
  await readFile(
    new URL('../node_modules/@imagemagick/magick-wasm/dist/x86/magick.wasm', import.meta.url),
  ),
);
for (const format of [
  'Psd',
  'Psb',
  'Dds',
  'Exr',
  'Hdr',
  'Jp2',
  'Jxl',
  'Qoi',
  'Tga',
  'Pcx',
  'Ppm',
  'Pbm',
  'Pgm',
  'Pam',
  'Miff',
  'Xbm',
  'Xpm',
  'Fits',
  'Cur',
]) {
  const data = ImageMagick.read(MagickColors.CornflowerBlue, 24, 16, (image) =>
    image.write(MagickFormat[format], (bytes) => Uint8Array.from(bytes)),
  );
  await writeFile(new URL(`sample.${format.toLowerCase()}`, destination), data);
}
const files = [
  { file: new File(['压缩包里面的中文内容'], 'hello.txt'), pathname: '目录/hello.txt' },
  {
    file: new File([await readFile(new URL('sample.psd', destination))], 'sample.psd'),
    pathname: '目录/sample.psd',
  },
  { file: new File(['padding'.repeat(20000)], 'padding.txt'), pathname: 'padding.txt' },
];
for (const [name, format, compression] of [
  ['archive.tgz', ArchiveFormat.USTAR, ArchiveCompression.GZIP],
  ['archive.bz2', ArchiveFormat.USTAR, ArchiveCompression.BZIP2],
  ['archive.xz', ArchiveFormat.USTAR, ArchiveCompression.XZ],
  ['archive.lz', ArchiveFormat.USTAR, ArchiveCompression.LZIP],
]) {
  const archive = await Archive.write({
    files,
    outputFileName: name,
    format,
    compression,
    passphrase: null,
  });
  await writeFile(new URL(name, destination), new Uint8Array(await archive.arrayBuffer()));
}
const tarParts = [];
for (const { file, pathname } of [...files, { file: new File([], 'empty'), pathname: '空目录/' }]) {
  const header = new Uint8Array(512);
  const field = (offset, length, text) =>
    header.set(new TextEncoder().encode(text).slice(0, length), offset);
  field(0, 100, pathname);
  field(100, 8, '0000644');
  field(108, 8, '0000000');
  field(116, 8, '0000000');
  field(124, 12, file.size.toString(8).padStart(11, '0'));
  field(136, 12, '00000000000');
  field(148, 8, '        ');
  field(156, 1, pathname.endsWith('/') ? '5' : '0');
  field(257, 6, 'ustar');
  field(263, 2, '00');
  field(
    148,
    8,
    [...header]
      .reduce((sum, value) => sum + value, 0)
      .toString(8)
      .padStart(6, '0') + '\0 ',
  );
  tarParts.push(
    header,
    new Uint8Array(await file.arrayBuffer()),
    new Uint8Array((512 - (file.size % 512)) % 512),
  );
}
tarParts.push(new Uint8Array(1024));
await writeFile(
  new URL('archive.tar', destination),
  new Uint8Array(await new Blob(tarParts).arrayBuffer()),
);
await writeFile(new URL('hello.txt.gz', destination), gzipSync(strToU8('独立 GZIP 完整内容')));
const SQL = await initSqlJs();
const database = new SQL.Database();
database.run('CREATE TABLE "中文表" (id INTEGER PRIMARY KEY, name TEXT, payload BLOB)');
database.run('CREATE TABLE empty (value TEXT)');
database.run('CREATE VIEW "中文视图" AS SELECT * FROM "中文表"');
for (let i = 0; i < 405; i++)
  database.run('INSERT INTO "中文表" VALUES (?, ?, ?)', [
    i + 1,
    `记录 ${i + 1}`,
    new Uint8Array([1, 2, 3]),
  ]);
await writeFile(new URL('sample.sqlite', destination), database.export());
database.close();
await writeFile(
  new URL('sample.eml', destination),
  [
    'From: Alice <alice@example.test>',
    'To: Bob <bob@example.test>',
    'Subject: =?UTF-8?B?6YKu5Lu26aKE6KeI?=',
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="preview"',
    '',
    '--preview',
    'Content-Type: text/html; charset=utf-8',
    '',
    '<h1>中文邮件正文</h1><script>window.untrustedRan=true</script><img src="https://example.invalid/tracker">',
    '--preview',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Disposition: attachment; filename="attachment.txt"',
    '',
    '附件完整内容',
    '--preview--',
    '',
  ].join('\r\n'),
);
const fontSource = new URL(
  '../node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf',
  import.meta.url,
);
await writeFile(new URL('sample.ttf', destination), await readFile(fontSource));
console.log('Format fixtures generated.');
