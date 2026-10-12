import { describe, expect, it } from 'vitest';
import { CFB } from 'xlsx';
import {
  asarHeaderSize,
  crxZipOffset,
  pakHeaderSize,
  parseAsar,
  parsePak,
  readCompound,
} from './package-container';

function asar(node: unknown, data = new TextEncoder().encode('中文内容')) {
  const json = new TextEncoder().encode(JSON.stringify(node));
  const base = 16 + Math.ceil(json.length / 4) * 4;
  const bytes = new Uint8Array(base + data.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 4, true);
  view.setUint32(4, base - 8, true);
  view.setUint32(8, base - 12, true);
  view.setUint32(12, json.length, true);
  bytes.set(json, 16);
  bytes.set(data, base);
  return bytes;
}

describe('application containers', () => {
  it('reads ASAR directories, ignores unpacked files and links, and bounds file ranges', () => {
    const bytes = asar({
      files: {
        目录: { files: { 'hello.txt': { size: 12, offset: '0' } } },
        empty: { files: {} },
        outside: { unpacked: true },
        link: { link: 'hello.txt' },
      },
    });
    const entries = parseAsar(bytes.subarray(0, asarHeaderSize(bytes)), bytes.length);
    expect(entries.map((entry) => entry.name).sort()).toEqual([
      'empty/',
      '目录/',
      '目录/hello.txt',
    ]);
    const entry = entries.find((entry) => !entry.directory)!;
    expect(new TextDecoder().decode(bytes.subarray(entry.offset))).toBe('中文内容');
    const broken = asar({ files: { bad: { size: 999999, offset: '0' } } });
    expect(() => parseAsar(broken, broken.length)).toThrow('偏移');
    expect(() => parseAsar(asar({ files: { '../bad': { size: 0, offset: '0' } } }), 1000)).toThrow(
      '文件名',
    );
  });
  it.each([2, 3])('locates CRX v%i embedded ZIP and rejects truncated headers', (version) => {
    const bytes = new Uint8Array(16),
      view = new DataView(bytes.buffer);
    bytes.set(new TextEncoder().encode('Cr24'));
    view.setUint32(4, version, true);
    view.setUint32(8, 4, true);
    if (version === 2) view.setUint32(12, 8, true);
    expect(crxZipOffset(bytes, 100)).toBe(version === 2 ? 28 : 16);
    expect(() => crxZipOffset(bytes, 20)).toThrow();
  });
  it('reads DataPack v5 resource offsets and aliases without assuming all PAKs are DataPacks', () => {
    const bytes = new Uint8Array(45),
      view = new DataView(bytes.buffer);
    view.setUint32(0, 5, true);
    view.setUint16(8, 2, true);
    view.setUint16(10, 1, true);
    for (const [i, id, offset] of [
      [0, 101, 34],
      [1, 102, 39],
      [2, 0, 45],
    ]) {
      view.setUint16(12 + i * 6, id, true);
      view.setUint32(14 + i * 6, offset, true);
    }
    view.setUint16(30, 201, true);
    view.setUint16(32, 0, true);
    expect(pakHeaderSize(bytes)).toBe(34);
    expect(
      parsePak(bytes, bytes.length).map(({ name, offset, size }) => ({ name, offset, size })),
    ).toEqual([
      { name: 'resource-101.dat', offset: 34, size: 5 },
      { name: 'resource-102.dat', offset: 39, size: 6 },
      { name: 'resource-201.dat', offset: 34, size: 5 },
    ]);
    view.setUint32(20, 1, true);
    expect(() => parsePak(bytes, bytes.length)).toThrow();
    view.setUint32(0, 1, true);
    expect(() => pakHeaderSize(bytes)).toThrow('Chromium');
  });
  it('lists and extracts Unicode OLE streams without executing embedded objects', async () => {
    const container = CFB.utils.cfb_new();
    CFB.utils.cfb_add(container, '目录/hello.txt', new TextEncoder().encode('复合文档中文'));
    const bytes = new Uint8Array(CFB.write(container, { type: 'array' }));
    const result = await readCompound(bytes);
    const entry = result.entries!.find((entry) => entry.name.endsWith('hello.txt'))!;
    expect(entry).toBeDefined();
    expect(new TextDecoder().decode((await readCompound(bytes, entry.index)).data)).toBe(
      '复合文档中文',
    );
    await expect(readCompound(bytes, 999)).rejects.toThrow();
  });
});
