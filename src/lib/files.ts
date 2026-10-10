import { sourceLanguage, sourceLanguages } from './source-languages';
export type PreviewKind =
  | 'image'
  | 'pdf'
  | 'text'
  | 'markdown'
  | 'video'
  | 'audio'
  | 'archive'
  | 'docx'
  | 'xlsx'
  | 'pptx'
  | 'csv'
  | 'odt'
  | 'ods'
  | 'odp'
  | 'epub'
  | 'html'
  | 'rtf'
  | 'fb2'
  | 'notebook'
  | 'dxf'
  | 'model'
  | 'tiff'
  | 'binary';
export interface PreviewFile {
  id: string;
  name: string;
  size: number;
  modified: number;
  mime: string;
  path?: string;
  blob?: Blob;
}

// The registry is the built-in plugin boundary. Unknown extensions always have a fallback.
export const engines: { kind: PreviewKind; extensions: string[]; label: string }[] = [
  {
    kind: 'image',
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'],
    label: '图像',
  },
  { kind: 'pdf', extensions: ['pdf'], label: 'PDF 文档' },
  { kind: 'dxf', extensions: ['dxf'], label: 'CAD 图纸' },
  { kind: 'model', extensions: ['stl', 'obj'], label: '三维模型' },
  { kind: 'tiff', extensions: ['tif', 'tiff'], label: 'TIFF 图像' },
  { kind: 'markdown', extensions: ['md', 'markdown', 'mdx'], label: 'Markdown' },
  { kind: 'docx', extensions: ['docx', 'docm', 'dotx', 'dotm'], label: 'Word 文档' },
  { kind: 'html', extensions: ['html', 'htm', 'xhtml'], label: 'HTML 文档' },
  { kind: 'rtf', extensions: ['rtf'], label: 'RTF 富文本' },
  { kind: 'xlsx', extensions: ['xlsx', 'xlsm', 'xltx', 'xltm'], label: 'Excel 工作簿' },
  {
    kind: 'pptx',
    extensions: ['pptx', 'pptm', 'potx', 'potm', 'ppsx', 'ppsm'],
    label: 'PowerPoint 文稿',
  },
  { kind: 'csv', extensions: ['csv', 'tsv', 'tab'], label: '分隔符表格' },
  { kind: 'odt', extensions: ['odt', 'ott'], label: 'OpenDocument 文档' },
  { kind: 'ods', extensions: ['ods', 'ots'], label: 'OpenDocument 表格' },
  { kind: 'odp', extensions: ['odp', 'otp'], label: 'OpenDocument 演示' },
  { kind: 'epub', extensions: ['epub'], label: 'EPUB 电子书' },
  { kind: 'fb2', extensions: ['fb2'], label: 'FictionBook 电子书' },
  { kind: 'notebook', extensions: ['ipynb'], label: 'Jupyter Notebook' },
  { kind: 'video', extensions: ['mp4', 'webm', 'mov', 'm4v', 'ogv'], label: '视频' },
  { kind: 'audio', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'], label: '音频' },
  {
    kind: 'archive',
    extensions: ['zip', 'jar', 'apk', 'ipa', 'cbz', 'whl', 'nupkg', 'vsix', 'xpi'],
    label: 'ZIP 压缩包',
  },
  {
    kind: 'text',
    extensions: [
      ...Object.keys(sourceLanguages),
      'txt',
      'text',
      'asc',
      'log',
      'js',
      'jsx',
      'ts',
      'tsx',
      'json',
      'jsonc',
      'py',
      'java',
      'c',
      'cpp',
      'h',
      'hpp',
      'cs',
      'go',
      'rs',
      'swift',
      'html',
      'css',
      'scss',
      'xml',
      'yaml',
      'yml',
      'sql',
      'toml',
      'ini',
      'conf',
      'env',
      'sh',
      'ps1',
      'bat',
      'diff',
      'patch',
      'vue',
      'svelte',
      'gitignore',
      'dockerfile',
      'rtf',
      'mjs',
      'cjs',
      'mts',
      'cts',
      'htm',
      'xhtml',
      'less',
      'sass',
      'rb',
      'php',
      'lua',
      'kt',
      'kts',
      'dart',
      'r',
      'jl',
      'pl',
      'pm',
      'cc',
      'cxx',
      'hh',
      'hxx',
      'cmake',
      'makefile',
      'gradle',
      'properties',
      'cfg',
      'config',
      'editorconfig',
      'gitconfig',
      'gitattributes',
      'npmrc',
      'nvmrc',
      'lock',
      'jsonl',
      'ndjson',
      'nd',
      'srt',
      'vtt',
      'ass',
      'ssa',
      'lrc',
      'tex',
      'bib',
      'rst',
      'adoc',
      'http',
      'graphql',
      'gql',
      'proto',
      'ipynb',
      'license',
      'readme',
      'gemfile',
      'rakefile',
    ],
    label: '文本与代码',
  },
];
export const extension = (name: string) => name.split('.').pop()!.toLowerCase();
export function detectKind(name: string): PreviewKind {
  if (
    sourceLanguage(name) !== 'plaintext' &&
    /^(?:dockerfile\.|containerfile\.|\.env\.)/i.test(name)
  )
    return 'text';
  return engines.find((e) => e.extensions.includes(extension(name)))?.kind ?? 'binary';
}
export function previewMime(name: string): string {
  const ext = extension(name);
  const kind = detectKind(name);
  if (kind === 'image')
    return (
      { svg: 'image/svg+xml', jpg: 'image/jpeg', ico: 'image/vnd.microsoft.icon' }[ext] ??
      `image/${ext}`
    );
  if (kind === 'audio') return { mp3: 'audio/mpeg', m4a: 'audio/mp4' }[ext] ?? `audio/${ext}`;
  if (kind === 'video')
    return { mov: 'video/quicktime', m4v: 'video/mp4', ogv: 'video/ogg' }[ext] ?? `video/${ext}`;
  if (kind === 'pdf') return 'application/pdf';
  if (kind === 'html') return 'text/html';
  if (kind === 'text' || kind === 'markdown') return 'text/plain';
  return 'application/octet-stream';
}
export function unsupportedFormatHint(name: string): string | undefined {
  const ext = extension(name);
  if (['doc', 'xls', 'ppt'].includes(ext))
    return '这是旧版 Office 格式，尚未接入专用引擎。可另存为 DOCX/XLSX/PPTX 后预览，或使用底部默认应用打开。';
  if (['rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'zst'].includes(ext))
    return '此压缩格式尚未接入目录与解压引擎。当前支持 ZIP/ZIP64 及兼容容器，可使用底部默认应用打开此文件。';
  if (['heic', 'heif', 'raw', 'cr2', 'cr3', 'nef', 'arw', 'dng', 'psd', 'ai'].includes(ext))
    return '此图片格式需要专用解码器，目前仅显示文件信息。请使用默认应用查看。';
  if (['sqlite', 'sqlite3', 'db'].includes(ext))
    return '数据库尚未支持表结构与记录预览，目前仅显示文件信息。';
  if (
    [
      'dwg',
      'dwt',
      'dws',
      'step',
      'stp',
      'iges',
      'igs',
      '3ds',
      'max',
      'blend',
      'sldprt',
      'sldasm',
    ].includes(ext)
  )
    return '此工程格式尚未接入专用引擎。二维图纸可导出 DXF，三维模型可导出 STL/OBJ 后预览，或使用底部默认应用打开。';
}
export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 4);
  return `${(bytes / 1024 ** unit).toFixed(unit === 1 ? 0 : 1)} ${['B', 'KB', 'MB', 'GB', 'TB'][unit]}`;
}
export function fromBrowser(file: File): PreviewFile {
  return {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    modified: file.lastModified,
    mime: file.type,
    blob: file,
  };
}
export type TextEncoding =
  'auto' | 'utf-8' | 'utf-16le' | 'utf-16be' | 'gb18030' | 'big5' | 'windows-1252' | 'shift_jis';
export function decodeText(bytes: Uint8Array, selected: TextEncoding = 'auto', partial = false) {
  const decode = (encoding: string, fatal = false) =>
    new TextDecoder(encoding, { fatal }).decode(bytes, { stream: partial });
  if (selected !== 'auto') return { text: decode(selected), encoding: selected.toUpperCase() };
  if (bytes[0] === 0xff && bytes[1] === 0xfe)
    return { text: decode('utf-16le'), encoding: 'UTF-16 LE' };
  if (bytes[0] === 0xfe && bytes[1] === 0xff)
    return { text: decode('utf-16be'), encoding: 'UTF-16 BE' };
  // BOM-less UTF-16 commonly occurs in Windows configuration/license files.
  const sample = bytes.slice(0, 4096);
  const pairs = Math.floor(sample.length / 2);
  if (pairs >= 2) {
    let even = 0,
      odd = 0;
    for (let i = 0; i < pairs * 2; i += 2) {
      even += Number(sample[i] === 0);
      odd += Number(sample[i + 1] === 0);
    }
    if (odd >= 2 && odd / pairs > 0.1 && even / pairs < 0.05)
      return { text: decode('utf-16le'), encoding: 'UTF-16 LE（推测）' };
    if (even >= 2 && even / pairs > 0.1 && odd / pairs < 0.05)
      return { text: decode('utf-16be'), encoding: 'UTF-16 BE（推测）' };
  }
  try {
    return { text: decode('utf-8', true), encoding: 'UTF-8' };
  } catch {
    return { text: decode('gb18030'), encoding: 'GB18030（推测）' };
  }
}

export function sniffKind(bytes: Uint8Array): PreviewKind {
  const hex = Array.from(bytes.slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
  if (hex.startsWith('25504446')) return 'pdf';
  if (hex.startsWith('7b5c727466')) return 'rtf';
  if (/^(89504e47|ffd8ff|47494638|424d)/.test(hex)) return 'image';
  if (hex.startsWith('504b0304')) return 'archive';
  if (/^(4d5a|7f454c46|d0cf11e0|53514c697465|52617221|377abcaf)/.test(hex)) return 'binary';
  const { text } = decodeText(bytes, 'auto', true);
  if (/^\s*(?:<!doctype\s+html|<html\b)/i.test(text)) return 'html';
  if (!text) return bytes.length ? 'binary' : 'text';
  const controls = [...text].filter((c) =>
    /[\u0000-\u0008\u000b\u000e-\u001f\ufffd]/.test(c),
  ).length;
  return controls / text.length <= 0.01 ? 'text' : 'binary';
}
export function hexDump(bytes: Uint8Array): string {
  return Array.from({ length: Math.ceil(bytes.length / 16) }, (_, row) => {
    const part = bytes.slice(row * 16, row * 16 + 16);
    const hex = Array.from(part, (x) => x.toString(16).padStart(2, '0'))
      .join(' ')
      .padEnd(47);
    const ascii = Array.from(part, (x) =>
      x >= 32 && x <= 126 ? String.fromCharCode(x) : '.',
    ).join('');
    return `${(row * 16).toString(16).padStart(8, '0')}    ${hex}    ${ascii}`;
  }).join('\n');
}
export function sniffMagic(bytes: Uint8Array) {
  const hex = Array.from(bytes.slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
  if (hex.startsWith('7f454c46')) return 'ELF 可执行文件';
  if (hex.startsWith('4d5a')) return 'Windows 可执行文件';
  if (hex.startsWith('504b0304')) return 'ZIP / OOXML 容器';
  if (hex.startsWith('53514c6974652066')) return 'SQLite 数据库';
  if (hex.startsWith('d0cf11e0')) return 'OLE 复合文档（旧版 Office 容器，不能按纯文本解码）';
  if (hex.startsWith('89504e47')) return 'PNG 图像';
  if (hex.startsWith('25504446')) return 'PDF 文档';
  return '通用二进制文件';
}
