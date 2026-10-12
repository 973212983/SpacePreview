import {
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
  MagickImageCollection,
  MagickReadSettings,
  ResourceLimits,
} from '@imagemagick/magick-wasm';
import { extension } from './files';
import { iconFrames } from './icon-container';

const cameraFormats = new Set([
  'arw',
  'cr2',
  'cr3',
  'crw',
  'dcr',
  'dng',
  'erf',
  'fff',
  'iiq',
  'k25',
  'kdc',
  'mdc',
  'mef',
  'mos',
  'mrw',
  'nef',
  'nrw',
  'orf',
  'pef',
  'raf',
  'rw2',
  'rwl',
  'sr2',
  'srf',
  'srw',
  'x3f',
]);
let initialized: Promise<void> | undefined;
export async function decodeImage(
  bytes: Uint8Array,
  name: string,
  page = 0,
): Promise<{ data: Uint8Array; pages: number; page: number; mime: string }> {
  const ext = extension(name);
  if (ext === 'svgz') {
    if (page !== 0) throw new Error('图片页码无效。');
    const data = (await import('fflate')).gunzipSync(bytes);
    return { data, pages: 1, page: 0, mime: 'image/svg+xml' };
  }
  if (ext === 'icns' || ext === 'ani') {
    const frames = iconFrames(bytes, ext);
    if (!Number.isInteger(page) || page < 0 || page >= frames.length)
      throw new Error('图标帧页码无效。');
    const image = await decodeImage(
      frames[page].bytes,
      `icon.${frames[page].format.toLowerCase()}`,
    );
    return { ...image, pages: frames.length, page };
  }
  initialized ??= initializeImageMagick(new URL('/engines/magick.wasm', self.location.href));
  await initialized;
  ResourceLimits.memory = 512n * 1024n * 1024n;
  ResourceLimits.disk = 0n;
  ResourceLimits.listLength = 4096n;
  ResourceLimits.time = 120n;
  const settings = new MagickReadSettings();
  settings.format = (
    cameraFormats.has(ext)
      ? 'DNG'
      : ({
          heif: 'HEIC',
          dicom: 'DCM',
          fit: 'FITS',
          j2k: 'J2K',
          jpc: 'JPC',
          jpf: 'JP2',
          jpx: 'JP2',
          pnm: 'PNM',
          svgz: 'SVG',
        }[ext] ?? ext.toUpperCase())
  ) as MagickFormat;
  const metadata = MagickImageCollection.create();
  let pages: number;
  try {
    metadata.ping(bytes, settings);
    pages = metadata.length;
    if (!pages || !Number.isInteger(page) || page < 0 || page >= pages)
      throw new Error('图片页码无效。');
    if (metadata[page].width * metadata[page].height > 100_000_000)
      throw new Error('图片像素超过 1 亿，无法在当前内存中解码。');
  } finally {
    metadata.dispose();
  }
  settings.frameIndex = page;
  settings.frameCount = 1;
  return ImageMagick.read(bytes, settings, (image) => {
    image.autoOrient();
    return image.write(MagickFormat.Png, (data) => ({
      data: Uint8Array.from(data),
      pages,
      page,
      mime: 'image/png',
    }));
  });
}
