import { expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { prepareDocx } from './docx';
import { listZip } from './archive';
it('preserves DOCX styles and media but removes executable payloads', () => {
  const bytes = zipSync({
    'word/document.xml': strToU8('<document/>'),
    'word/styles.xml': strToU8('<styles/>'),
    'word/media/image.png': new Uint8Array([1, 2, 3]),
    'word/vbaProject.bin': new Uint8Array([0]),
    'word/embeddings/object.bin': new Uint8Array([0]),
  });
  expect(listZip(prepareDocx(bytes)).map((e) => e.name)).toEqual([
    'word/document.xml',
    'word/styles.xml',
    'word/media/image.png',
  ]);
});
it('rejects invalid Word files and custom XML entities before layout parsing', () => {
  expect(() => prepareDocx(zipSync({ 'other.txt': strToU8('x') }))).toThrow('DOCX');
  expect(() =>
    prepareDocx(zipSync({ 'word/document.xml': strToU8('<!DOCTYPE x [<!ENTITY x "bad">]><x/>') })),
  ).toThrow('实体');
});
