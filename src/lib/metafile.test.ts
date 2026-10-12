import { describe, expect, it } from 'vitest';
import { metafileBounds } from './metafile';
describe('Windows vector record validation', () => {
  it('reads EMF bounds and rejects non-advancing/truncated records', () => {
    const bytes = new Uint8Array(108),
      view = new DataView(bytes.buffer);
    view.setUint32(0, 1, true);
    view.setUint32(4, 88, true);
    view.setInt32(16, 240, true);
    view.setInt32(20, 160, true);
    view.setUint32(40, 0x464d4520, true);
    view.setUint32(48, bytes.length, true);
    view.setUint32(88, 14, true);
    view.setUint32(92, 20, true);
    expect(metafileBounds(bytes, true)).toEqual({ width: 240, height: 160, records: 2 });
    view.setUint32(92, 0, true);
    expect(() => metafileBounds(bytes, true)).toThrow('记录');
  });
  it('reads WMF window extents and rejects invalid record lengths', () => {
    const bytes = new Uint8Array(34),
      view = new DataView(bytes.buffer);
    view.setUint16(0, 1, true);
    view.setUint16(2, 9, true);
    view.setUint16(4, 0x300, true);
    view.setUint32(6, 17, true);
    view.setUint32(18, 5, true);
    view.setUint16(22, 0x020c, true);
    view.setInt16(24, 160, true);
    view.setInt16(26, 240, true);
    view.setUint32(28, 3, true);
    expect(metafileBounds(bytes, false)).toEqual({ width: 240, height: 160, records: 2 });
    view.setUint32(18, 0, true);
    expect(() => metafileBounds(bytes, false)).toThrow('记录');
  });
});
