import { readFile } from 'node:fs/promises';
import { CFB } from 'xlsx';
import { gzipSync, strToU8, zipSync, zlibSync } from 'fflate';

export async function containerFixtures() {
  const picture = new Uint8Array(
    await readFile(new URL('../src-tauri/icons/icon.png', import.meta.url)),
  );
  const text = strToU8('容器里面的中文内容');
  const result = {};
  const json = strToU8(
    JSON.stringify({
      files: {
        目录: {
          files: {
            'hello.txt': { size: text.length, offset: '0' },
            'picture.png': { size: picture.length, offset: String(text.length) },
          },
        },
        空目录: { files: {} },
      },
    }),
  );
  const base = 16 + Math.ceil(json.length / 4) * 4;
  const asar = new Uint8Array(base + text.length + picture.length),
    av = new DataView(asar.buffer);
  av.setUint32(0, 4, true);
  av.setUint32(4, base - 8, true);
  av.setUint32(8, base - 12, true);
  av.setUint32(12, json.length, true);
  asar.set(json, 16);
  asar.set(text, base);
  asar.set(picture, base + text.length);
  result['sample.asar'] = asar;
  const zip = zipSync({ 'hello.txt': text, 'picture.png': picture });
  for (const version of [2, 3]) {
    const crx = new Uint8Array(16 + zip.length),
      cv = new DataView(crx.buffer);
    crx.set(strToU8('Cr24'));
    cv.setUint32(4, version, true);
    cv.setUint32(8, version === 3 ? 4 : 0, true);
    crx.set(zip, 16);
    result[`crx${version}.crx`] = crx;
  }
  for (const ext of ['cfb', 'eif', 'msi', 'msp']) {
    const cfb = CFB.utils.cfb_new();
    CFB.utils.cfb_add(cfb, '目录/hello.txt', text);
    CFB.utils.cfb_add(cfb, '目录/picture.png', picture);
    result[`sample.${ext}`] = new Uint8Array(CFB.write(cfb, { type: 'array' }));
  }
  const pak = new Uint8Array(24 + text.length),
    pv = new DataView(pak.buffer);
  pv.setUint32(0, 5, true);
  pv.setUint16(8, 1, true);
  pv.setUint16(12, 100, true);
  pv.setUint32(14, 24, true);
  pv.setUint32(20, pak.length, true);
  pak.set(text, 24);
  result['sample.pak'] = pak;
  for (const ext of [
    'aab',
    'appx',
    'appxbundle',
    'msix',
    'msixbundle',
    'hap',
    'wgt',
    'wgtu',
    'qlplugin',
  ])
    result[`sample.${ext}`] = zip;

  const fontNames = ['LiberationSans-Regular', 'LiberationSans-Bold'];
  const fonts = await Promise.all(
    fontNames.map((name) =>
      readFile(new URL(`../node_modules/pdfjs-dist/standard_fonts/${name}.ttf`, import.meta.url)),
    ),
  );
  const offsets = [20, 20 + Math.ceil(fonts[0].length / 4) * 4];
  const ttc = new Uint8Array(offsets[1] + Math.ceil(fonts[1].length / 4) * 4),
    tv = new DataView(ttc.buffer);
  ttc.set(strToU8('ttcf'));
  tv.setUint32(4, 0x10000);
  tv.setUint32(8, 2);
  for (const [face, font] of fonts.entries()) {
    const base = offsets[face];
    tv.setUint32(12 + face * 4, base);
    ttc.set(font, base);
    const tables = tv.getUint16(base + 4);
    for (let i = 0; i < tables; i++) {
      const position = base + 12 + i * 16 + 8;
      tv.setUint32(position, tv.getUint32(position) + base);
    }
  }
  result['sample.ttc'] = ttc;
  for (const [ext, path] of [
    ['kra', 'mergedimage.png'],
    ['sketch', 'previews/preview.png'],
    ['xd', 'preview.png'],
    ['xmind', 'Thumbnails/thumbnail.png'],
    ['fig', 'thumbnail.png'],
    ['cdr', 'previews/thumbnail.png'],
    ['pix', 'document.thumb.png'],
    ['pip', 'document.thumb.png'],
  ])
    result[`sample.${ext}`] = zipSync({ [path]: picture, 'document.json': strToU8('{}') });
  const xml = strToU8(
    `<pdnImage><custom><thumb png="${Buffer.from(picture).toString('base64')}"/></custom></pdnImage>`,
  );
  const pdn = new Uint8Array(7 + xml.length);
  pdn.set(strToU8('PDN3'));
  pdn[4] = xml.length & 255;
  pdn[5] = (xml.length >> 8) & 255;
  pdn[6] = (xml.length >> 16) & 255;
  pdn.set(xml, 7);
  result['sample.pdn'] = pdn;
  const icns = new Uint8Array(16 + picture.length),
    iv = new DataView(icns.buffer);
  icns.set(strToU8('icns'));
  iv.setUint32(4, icns.length);
  icns.set(strToU8('ic09'), 8);
  iv.setUint32(12, 8 + picture.length);
  icns.set(picture, 16);
  result['sample.icns'] = icns;
  const cursor = new Uint8Array(
    await readFile(new URL('../test-results/fixtures/sample.cur', import.meta.url)),
  );
  const iconChunk = 8 + cursor.length + (cursor.length & 1);
  const ani = new Uint8Array(24 + iconChunk * 2),
    nv = new DataView(ani.buffer);
  ani.set(strToU8('RIFF'));
  nv.setUint32(4, ani.length - 8, true);
  ani.set(strToU8('ACONLIST'), 8);
  nv.setUint32(16, ani.length - 20, true);
  ani.set(strToU8('fram'), 20);
  for (const position of [24, 24 + iconChunk]) {
    ani.set(strToU8('icon'), position);
    nv.setUint32(position + 4, cursor.length, true);
    ani.set(cursor, position + 8);
  }
  result['sample.ani'] = ani;
  result['sample.svgz'] = gzipSync(
    strToU8(
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="#168ed0"/><text x="20" y="80" font-size="24">中文 SVGZ</text></svg>',
    ),
  );

  const mhtml = [
    'MIME-Version: 1.0',
    'Content-Type: multipart/related; boundary=web',
    '',
    '--web',
    'Content-Type: text/html; charset=utf-8',
    'Content-Location: https://example.test/page.html',
    '',
    '<html><head><link rel="stylesheet" href="style.css"></head><body><h1>完整网页存档</h1><img src="picture.png"><img src="https://example.invalid/tracker"><script>window.untrustedRan=true</script></body></html>',
    '--web',
    'Content-Type: text/css',
    'Content-Location: https://example.test/style.css',
    '',
    'h1{color:rgb(22,142,208)}',
    '--web',
    'Content-Type: image/png',
    'Content-Location: https://example.test/picture.png',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(picture).toString('base64'),
    '--web--',
    '',
  ].join('\r\n');
  result['sample.mhtml'] = strToU8(mhtml);

  const arHeader = (name, bytes) =>
    strToU8(
      `${name.padEnd(16)}${'0'.padEnd(12)}${'0'.padEnd(6)}${'0'.padEnd(6)}${'100644'.padEnd(8)}${String(bytes.length).padEnd(10)}\x60\n`,
    );
  result['sample.ar'] = new Uint8Array(
    await new Blob([
      strToU8('!<arch>\n'),
      arHeader('hello.txt/', text),
      text,
      ...(text.length & 1 ? [strToU8('\n')] : []),
    ]).arrayBuffer(),
  );
  const cpioParts = [];
  for (const [name, bytes] of [
    ['hello.txt', text],
    ['TRAILER!!!', new Uint8Array()],
  ]) {
    const fields = [1, 0o100644, 0, 0, 1, 0, bytes.length, 0, 0, 0, 0, strToU8(name).length + 1, 0];
    const header = strToU8(
      '070701' + fields.map((value) => value.toString(16).padStart(8, '0')).join(''),
    );
    const filename = strToU8(name + '\0');
    cpioParts.push(
      header,
      filename,
      new Uint8Array((4 - ((header.length + filename.length) % 4)) % 4),
      bytes,
      new Uint8Array((4 - (bytes.length % 4)) % 4),
    );
  }
  result['sample.cpio'] = new Uint8Array(await new Blob(cpioParts).arrayBuffer());
  const toc = strToU8(
    `<xar><toc><file id="1"><name>hello.txt</name><type>file</type><data><offset>0</offset><size>${text.length}</size><length>${text.length}</length><encoding style="application/octet-stream"/></data></file></toc></xar>`,
  );
  const compressed = zlibSync(toc),
    xar = new Uint8Array(28 + compressed.length + text.length),
    xv = new DataView(xar.buffer);
  xar.set(strToU8('xar!'));
  xv.setUint16(4, 28);
  xv.setUint16(6, 1);
  xv.setBigUint64(8, BigInt(compressed.length));
  xv.setBigUint64(16, BigInt(toc.length));
  xar.set(compressed, 28);
  xar.set(text, 28 + compressed.length);
  result['sample.xar'] = xar;
  return result;
}
