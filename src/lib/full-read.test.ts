import { expect, it } from 'vitest';
import { readWholeFile } from './full-read';
import { decodeText } from './files';

it('preserves UTF8 characters across internal read boundaries', async () => {
  const text = 'a'.repeat(4 * 1024 * 1024 - 1) + '中文末尾';
  const source = new TextEncoder().encode(text);
  const bytes = await readWholeFile(
    source.length,
    async (offset, length) => source.slice(offset, offset + length),
    new AbortController().signal,
  );
  expect(decodeText(bytes).text).toBe(text);
});

it('loads all bytes above the native single-read limit with progress', async () => {
  const size = 33 * 1024 * 1024 + 3;
  const ranges: number[] = [],
    progress: number[] = [];
  const bytes = await readWholeFile(
    size,
    async (offset, length) => {
      ranges.push(length);
      const chunk = new Uint8Array(length);
      for (let index = 0; index < length; index++) chunk[index] = (offset + index) % 251;
      return chunk;
    },
    new AbortController().signal,
    (value) => progress.push(value),
  );
  expect(bytes.length).toBe(size);
  expect(bytes.at(-1)).toBe((size - 1) % 251);
  expect(Math.max(...ranges)).toBe(4 * 1024 * 1024);
  expect(progress[0]).toBe(0);
  expect(progress.at(-1)).toBe(100);
  expect(progress).toEqual([...progress].sort((a, b) => a - b));
});

it('cancels between reads and rejects an incomplete file instead of showing a prefix', async () => {
  const controller = new AbortController();
  let reads = 0;
  await expect(
    readWholeFile(
      8 * 1024 * 1024,
      async (_, length) => {
        reads++;
        controller.abort();
        return new Uint8Array(length);
      },
      controller.signal,
    ),
  ).rejects.toThrow();
  expect(reads).toBe(1);
  await expect(
    readWholeFile(10, async () => new Uint8Array(9), new AbortController().signal),
  ).rejects.toThrow('不完整');
});
