import { describe, expect, it } from 'vitest';
import { zlibSync } from 'fflate';
import { inflateZlib, parseXar } from './xar-container';

function xar(xml: string, content: Uint8Array) {
  const raw = new TextEncoder().encode(xml),
    compressed = zlibSync(raw);
  const bytes = new Uint8Array(28 + compressed.length + content.length),
    view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('xar!'));
  view.setUint16(4, 28);
  view.setUint16(6, 1);
  view.setBigUint64(8, BigInt(compressed.length));
  view.setBigUint64(16, BigInt(raw.length));
  bytes.set(compressed, 28);
  bytes.set(content, 28 + compressed.length);
  return bytes;
}
describe('XAR directories and bounded zlib streams', () => {
  it('reads nested directories and compressed entry ranges', () => {
    const raw = new TextEncoder().encode('完整中文内容'),
      data = zlibSync(raw);
    const bytes = xar(
      `<xar><toc><file><name>目录</name><type>directory</type><file><name>hello.txt</name><type>file</type><data><offset>0</offset><length>${raw.length}</length><size>${data.length}</size><encoding style="application/x-gzip"/></data></file></file></toc></xar>`,
      data,
    );
    const entries = parseXar(bytes, bytes.length);
    expect(entries.map((item) => item.name)).toEqual(['目录/', '目录/hello.txt']);
    const entry = entries[1];
    expect(new TextDecoder().decode(inflateZlib(bytes.subarray(entry.offset), entry.size))).toBe(
      '完整中文内容',
    );
    expect(() => inflateZlib(data, raw.length - 1)).toThrow('超过');
    expect(() => inflateZlib(data, raw.length + 1)).toThrow('截断');
  });
  it('rejects entities and data beyond the end of the archive', () => {
    const entity = xar('<!DOCTYPE xar [<!ENTITY bad "x">]><xar><toc/></xar>', new Uint8Array());
    expect(() => parseXar(entity, entity.length)).toThrow('实体');
    const truncated = xar(
      '<xar><toc><file><name>a</name><type>file</type><data><offset>0</offset><length>9</length><size>9</size></data></file></toc></xar>',
      new Uint8Array(),
    );
    expect(() => parseXar(truncated, truncated.length)).toThrow('范围');
  });
});
