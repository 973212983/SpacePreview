import { readRange } from './bridge';
import type { PreviewFile } from './files';
import { readZipDirectory, readZipEntry } from './zip-range';
import { parseInWorker } from './worker-client';
import { extension } from './files';

export async function designThumbnail(
  file: PreviewFile,
  signal: AbortSignal,
): Promise<PreviewFile> {
  if (extension(file.name) === 'pdn') {
    const header = await readRange(file, 0, Math.min(file.size, 7));
    if (header.length < 7 || new TextDecoder().decode(header.slice(0, 4)) !== 'PDN3')
      throw new Error('仅支持含内置预览图的 PDN3 文件。');
    const length = header[4] + (header[5] << 8) + (header[6] << 16);
    if (!length || length > file.size - 7) throw new Error('PDN XML 头已截断。');
    const bytes = await readRange(file, 7, length);
    signal.throwIfAborted();
    const result = await parseInWorker(
      { kind: 'design-thumbnail', name: file.name, bytes },
      signal,
    );
    const blob = new Blob([result.data as Uint8Array<ArrayBuffer>], { type: 'image/png' });
    return {
      ...file,
      id: `${file.id}:thumbnail`,
      path: undefined,
      blob,
      name: 'thumbnail.png',
      size: blob.size,
      mime: 'image/png',
    };
  }
  const directory = await readZipDirectory(file.size, (offset, length) =>
    readRange(file, offset, length),
  );
  const parsed = await parseInWorker(
    { kind: 'archive-directory', name: file.name, ...directory },
    signal,
  );
  const names = [
    'mergedimage.png',
    'previews/preview.png',
    'previews/thumbnail.png',
    'thumbnails/thumbnail.png',
    'thumbnail/thumbnail.png',
    'thumbnail.png',
    'preview.png',
  ];
  const entry = parsed
    .entries!.filter((item) => !item.directory)
    .sort((a, b) => names.indexOf(a.name.toLowerCase()) - names.indexOf(b.name.toLowerCase()))
    .find((item) => names.includes(item.name.toLowerCase()) || /\.thumb\.png$/i.test(item.name));
  if (!entry) throw new Error('此设计文件没有内置预览图。');
  const bytes = await readZipEntry(entry, file.size, (offset, length) =>
    readRange(file, offset, length),
  );
  const result = await parseInWorker(
    { kind: 'archive-data', name: file.name, bytes, entry },
    signal,
  );
  const blob = new Blob([result.data as Uint8Array<ArrayBuffer>], { type: 'image/png' });
  return {
    ...file,
    id: `${file.id}:thumbnail`,
    path: undefined,
    name: entry.name,
    blob,
    size: blob.size,
    mime: 'image/png',
  };
}
