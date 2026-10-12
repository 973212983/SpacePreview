import { describe, expect, it } from 'vitest';
import { fontCollection } from './font-collection';

function collection() {
  const bytes = new Uint8Array(88),
    view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('ttcf'));
  view.setUint32(4, 0x10000);
  view.setUint32(8, 2);
  view.setUint32(12, 20);
  view.setUint32(16, 48);
  for (const offset of [20, 48]) {
    view.setUint32(offset, 0x10000);
    view.setUint16(offset + 4, 1);
    view.setUint32(offset + 12, 0x68656164);
    view.setUint32(offset + 20, 76);
    view.setUint32(offset + 24, 12);
  }
  return bytes;
}
describe('TrueType collections', () => {
  it('relocates shared font tables and recomputes the SFNT checksum for both faces', () => {
    for (const page of [0, 1]) {
      const result = fontCollection(collection(), page);
      const view = new DataView(result.bytes.buffer);
      expect(result.count).toBe(2);
      expect(view.getUint32(20)).toBe(28);
      let checksum = 0;
      for (let i = 0; i < result.bytes.length; i += 4)
        checksum = (checksum + view.getUint32(i)) >>> 0;
      expect(checksum).toBe(0xb1b0afba);
    }
  });
  it('rejects invalid face indices, table ranges and truncated TTC headers', () => {
    expect(() => fontCollection(collection(), 2)).toThrow();
    expect(() => fontCollection(new TextEncoder().encode('ttcf'))).toThrow('截断');
    const bytes = collection();
    new DataView(bytes.buffer).setUint32(40, 999);
    expect(() => fontCollection(bytes)).toThrow('截断');
  });
});
