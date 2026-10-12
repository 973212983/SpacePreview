import { writeFile, mkdir } from 'node:fs/promises';
const destination = new URL('../test-results/fixtures/', import.meta.url);
await mkdir(destination, { recursive: true });
function uudecode(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith('begin '));
  const bytes = [];
  for (const line of lines.slice(start + 1)) {
    if (line === 'end') break;
    const count = (line.charCodeAt(0) - 32) & 63;
    for (let i = 1, remaining = count; remaining > 0; i += 4, remaining -= 3) {
      const [a, b, c, d] = Array.from(
        line.slice(i, i + 4),
        (char) => (char.charCodeAt(0) - 32) & 63,
      );
      bytes.push(((a << 2) | (b >> 4)) & 255);
      if (remaining > 1) bytes.push(((b << 4) | (c >> 2)) & 255);
      if (remaining > 2) bytes.push(((c << 6) | d) & 255);
    }
  }
  return new Uint8Array(bytes);
}
for (const [name, url, uu] of [
  [
    'sample.heic',
    'https://raw.githubusercontent.com/strukturag/libheif/master/examples/example.heic',
    false,
  ],
  [
    'sample.rar',
    'https://raw.githubusercontent.com/libarchive/libarchive/master/libarchive/test/test_read_format_rar.rar.uu',
    true,
  ],
  [
    'sample-rar5.rar',
    'https://raw.githubusercontent.com/libarchive/libarchive/master/libarchive/test/test_read_format_rar5_multiple_files.rar.uu',
    true,
  ],
  [
    'archive.7z',
    'https://raw.githubusercontent.com/libarchive/libarchive/master/libarchive/test/test_read_format_7zip_lzma1_2.7z.uu',
    true,
  ],
  [
    'archive.zst',
    'https://raw.githubusercontent.com/libarchive/libarchive/master/libarchive/test/test_compat_zstd_1.tar.zst.uu',
    true,
  ],
  [
    'archive.lzma',
    'https://raw.githubusercontent.com/libarchive/libarchive/master/libarchive/test/test_compat_lzma_1.tlz.uu',
    true,
  ],
  [
    'sample.msg',
    'https://raw.githubusercontent.com/HiraokaHyperTools/msgreader/master/test/Hello%20%2BCJK.msg',
    false,
  ],
  [
    'sample.3ds',
    'https://raw.githubusercontent.com/kovacsv/assimpjs/main/examples/testfiles/cube_with_materials.3ds',
    false,
  ],
  [
    'sample.fbx',
    'https://raw.githubusercontent.com/assimp/assimp/master/test/models/FBX/box.fbx',
    false,
  ],
  [
    'sample.ply',
    'https://raw.githubusercontent.com/assimp/assimp/master/test/models/PLY/cube.ply',
    false,
  ],
  [
    'sample.3mf',
    'https://raw.githubusercontent.com/assimp/assimp/master/test/models/3MF/box.3mf',
    false,
  ],
  [
    'sample.blend',
    'https://raw.githubusercontent.com/assimp/assimp/master/test/models/BLEND/BlenderDefault_248.blend',
    false,
  ],
  [
    'sample.dae',
    'https://raw.githubusercontent.com/assimp/assimp/master/test/models/Collada/cube_triangulate.dae',
    false,
  ],
  [
    'sample.step',
    'https://raw.githubusercontent.com/kovacsv/occt-import-js/main/test/testfiles/simple-basic-cube/cube.stp',
    false,
  ],
  [
    'sample.brep',
    'https://raw.githubusercontent.com/kovacsv/occt-import-js/main/test/testfiles/cax-if-brep/as1_pe_203.brep',
    false,
  ],
  [
    'sample.iges',
    'https://raw.githubusercontent.com/kovacsv/occt-import-js/main/test/testfiles/cube-10x10mm/Cube%2010x10.igs',
    false,
  ],
  [
    'camera.kdc',
    'https://raw.githubusercontent.com/letmaik/rawpy/main/test/RAW_KODAK_DC50_%C3%A9.KDC',
    false,
  ],
  [
    'camera.cr2',
    'https://raw.githubusercontent.com/letmaik/rawpy/main/test/RAW_CANON_40D_SRAW_V103.CR2',
    false,
  ],
  [
    'sample.wmf',
    'https://raw.githubusercontent.com/tbluemel/rtf.js/master/test/wmf-test-files/car-1/source.wmf',
    false,
  ],
  [
    'sample.emf',
    'https://raw.githubusercontent.com/tbluemel/rtf.js/master/test/emf-test-files/image-1/source.emf',
    false,
  ],
]) {
  const response = await fetch(url);
  if (!response.ok) {
    console.log(name, response.status);
    continue;
  }
  const bytes = uu ? uudecode(await response.text()) : new Uint8Array(await response.arrayBuffer());
  await writeFile(new URL(name, destination), bytes);
  console.log(name, bytes.length);
}
