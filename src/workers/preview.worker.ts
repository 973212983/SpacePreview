import hljs from '../lib/highlighter';
import { sourceLanguage } from '../lib/source-languages';
import { decodeHtml } from '../lib/html';
import { marked } from 'marked';
import { decodeText, extension } from '../lib/files';
import { listZip, extractZipEntries } from '../lib/archive';
import { readWorkbook, readSlides } from '../lib/office';
import { readDelimited, readOpenDocument, readEpub, readFictionBook } from '../lib/extra-formats';
import { readNotebook } from '../lib/notebook';
import type { WorkerRequest, WorkerResult } from '../lib/worker-types';
import { prepareDocx } from '../lib/docx';
import { parseZipDirectory, inflateZipEntry } from '../lib/zip-range';

const languages: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  rs: 'rust',
  sh: 'bash',
  yml: 'yaml',
  md: 'markdown',
  vue: 'xml',
  html: 'xml',
  cs: 'csharp',
  h: 'c',
  jsonc: 'json',
  mjs: 'javascript',
  cjs: 'javascript',
  mts: 'typescript',
  cts: 'typescript',
  htm: 'xml',
  xhtml: 'xml',
  svelte: 'xml',
  kt: 'kotlin',
  kts: 'kotlin',
  rb: 'ruby',
  cc: 'cpp',
  cxx: 'cpp',
  hxx: 'cpp',
  jsonl: 'json',
  ndjson: 'json',
  ipynb: 'json',
  tex: 'latex',
  ps1: 'powershell',
  cfg: 'ini',
  properties: 'ini',
};
marked.use({
  renderer: {
    code({ text, lang }) {
      const language = (lang || '').split(/\s+/)[0];
      const html = hljs.highlight(text, {
        language: hljs.getLanguage(language) ? language : 'plaintext',
        ignoreIllegals: true,
      }).value;
      return `<pre><code>${html}</code></pre>`;
    },
  },
});
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  try {
    const { kind, bytes, name } = event.data;
    let result: WorkerResult;
    if (kind === 'dxf') result = { drawing: (await import('../lib/cad')).readDxf(bytes) };
    else if (kind === 'model')
      result = { positions: (await import('../lib/model')).readModel(bytes, name) };
    else if (kind === 'tiff')
      result = { raster: (await import('../lib/tiff')).readTiff(bytes, event.data.page) };
    else if (kind === 'archive') result = { entries: listZip(bytes) };
    else if (kind === 'archive-directory')
      result = { entries: parseZipDirectory(bytes, event.data.count!) };
    else if (kind === 'archive-data') result = { data: inflateZipEntry(bytes, event.data.entry!) };
    else if (kind === 'docx-layout') result = { data: prepareDocx(bytes) };
    else if (kind === 'csv')
      result = { sheets: [readDelimited(bytes, name)], note: '只读表格 · 保留原始单元格内容' };
    else if (kind === 'odt' || kind === 'ods' || kind === 'odp')
      result = readOpenDocument(bytes, kind);
    else if (kind === 'epub') result = readEpub(bytes);
    else if (kind === 'fb2') result = readFictionBook(bytes);
    else if (kind === 'notebook')
      result = await readNotebook(
        bytes,
        async (text) => await marked.parse(text),
        (text, language) =>
          hljs.highlight(text, {
            language: hljs.getLanguage(language) ? language : 'plaintext',
            ignoreIllegals: true,
          }).value,
      );
    else if (kind === 'xlsx') result = { sheets: readWorkbook(bytes) };
    else if (kind === 'pptx') result = { slides: readSlides(bytes) };
    else if (kind === 'archive-entry') {
      const entry = listZip(bytes).find((e) => e.name === event.data.entryName && !e.directory);
      if (!entry) throw new Error('压缩包条目不存在。');
      if (entry.size > 8 * 1024 * 1024) throw new Error('内部文件超过 8 MB 预览上限。');
      const data = extractZipEntries(
        bytes,
        new Set([entry.name]),
        8 * 1024 * 1024,
        8 * 1024 * 1024,
      )[entry.name];
      if (!data || data.length > 8 * 1024 * 1024) throw new Error('内部文件无法读取或解压后过大。');
      result = { data };
    } else if (kind === 'docx') {
      const mammoth = await import('mammoth/mammoth.browser');
      const verified = prepareDocx(bytes, false);
      const doc = await mammoth.convertToHtml(
        { arrayBuffer: verified.buffer as ArrayBuffer },
        { convertImage: mammoth.images.imgElement(async () => ({ src: '' })) },
      );
      result = { html: doc.value };
    } else {
      let { text, encoding } =
        kind === 'html'
          ? decodeHtml(bytes, event.data.encoding)
          : decodeText(bytes, event.data.encoding, event.data.partial);
      const ext = extension(name);
      if (ext === 'json') {
        try {
          text = JSON.stringify(JSON.parse(text), null, 2);
        } catch {
          /* Keep incomplete or invalid JSON readable. */
        }
      }
      const language = languages[ext] ?? sourceLanguage(name);
      const html =
        kind === 'html'
          ? text
          : kind === 'markdown'
            ? await marked.parse(text)
            : hljs.highlight(text, {
                language: hljs.getLanguage(language) ? language : 'plaintext',
                ignoreIllegals: true,
              }).value;
      result = { text, html, encoding, language, lines: text.split('\n').length };
    }
    if (result.positions) self.postMessage(result, { transfer: [result.positions.buffer] });
    else if (result.raster) self.postMessage(result, { transfer: [result.raster.pixels.buffer] });
    else if (result.data) self.postMessage(result, { transfer: [result.data.buffer] });
    else self.postMessage(result);
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
