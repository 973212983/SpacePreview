import { describe, expect, it } from 'vitest';
import { readInStages } from './progressive-read';
import { decodeText } from './files';
import { readDelimited } from './extra-formats';

describe('progressive content reads', () => {
  it('publishes before later reads and preserves every byte through the final stage', async () => {
    const source = new Uint8Array(600000).map((_, index) => index % 251);
    const stages: number[] = [];
    const reads: number[] = [];
    await readInStages(
      source.length,
      async (offset, length) => {
        if (offset >= 65536) expect(stages.length).toBeGreaterThan(0);
        reads.push(length);
        return source.slice(offset, offset + length);
      },
      new AbortController().signal,
      async (bytes, complete) => {
        stages.push(bytes.length);
        // Compare every byte without the assertion library's large-object traversal.
        expect(bytes.every((byte, index) => byte === source[index])).toBe(true);
        expect(complete).toBe(bytes.length === source.length);
      },
      () => {},
    );
    expect(stages).toEqual([65536, 262144, 600000]);
    expect(Math.max(...reads)).toBeLessThanOrEqual(4 * 1024 * 1024);
  });
  it('stops subsequent reads when cancelled after the first publish', async () => {
    const controller = new AbortController();
    let reads = 0;
    await expect(
      readInStages(
        500000,
        async (_, length) => {
          reads++;
          return new Uint8Array(length);
        },
        controller.signal,
        async () => controller.abort(),
        () => {},
      ),
    ).rejects.toThrow();
    expect(reads).toBe(1);
  });
  it('rejects short reads after preserving a published prefix', async () => {
    let published = 0;
    await expect(
      readInStages(
        500000,
        async (offset, length) => new Uint8Array(offset ? 1 : length),
        new AbortController().signal,
        async () => {
          published++;
        },
        () => {},
      ),
    ).rejects.toThrow('读取不完整');
    expect(published).toBe(1);
  });
  it('does not expose incomplete CSV records or broken multibyte characters', () => {
    const bytes = new TextEncoder().encode('name,note\nfirst,完整\nsecond,"多行\n未结束');
    expect(readDelimited(bytes, 'data.csv', true).rows).toEqual([
      ['name', 'note'],
      ['first', '完整'],
    ]);
    expect(() => readDelimited(bytes, 'data.csv')).toThrow('未闭合');
    const utf8 = new TextEncoder().encode('Hello中文');
    expect(decodeText(utf8.slice(0, -1), 'utf-8', true).text).toBe('Hello中');
  });
});
