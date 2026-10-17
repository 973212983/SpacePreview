import type { TextEncoding } from './files';

export const textEncodings = [
  'auto',
  'utf-8',
  'utf-16le',
  'utf-16be',
  'gb18030',
  'big5',
  'windows-1252',
  'shift_jis',
] as const;
export type PreviewPreferences = {
  font: 'auto' | 'sans' | 'serif' | 'mono';
  size: number;
  wrap: boolean;
  encoding: TextEncoding;
  html: 'source' | 'web';
};
export function parsePreviewPreferences(raw: string | null): PreviewPreferences {
  let value: Partial<PreviewPreferences> = {};
  try {
    value = JSON.parse(raw || '{}') || {};
  } catch {
    /* Use defaults for damaged settings. */
  }
  return {
    font: ['auto', 'sans', 'serif', 'mono'].includes(value.font ?? '') ? value.font! : 'auto',
    size:
      typeof value.size === 'number' &&
      Number.isInteger(value.size) &&
      value.size >= 10 &&
      value.size <= 40
        ? value.size
        : 16,
    wrap: value.wrap !== false,
    encoding: textEncodings.includes(value.encoding as (typeof textEncodings)[number])
      ? value.encoding!
      : 'auto',
    html: value.html === 'web' ? 'web' : 'source',
  };
}
