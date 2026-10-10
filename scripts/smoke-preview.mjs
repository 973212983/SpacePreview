import { Worker } from 'node:worker_threads';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import './extra-fixtures.mjs';
import './reading-fixtures.mjs';
import './graphics-fixtures.mjs';

const assets = new URL('../dist/assets/', import.meta.url);
const bundleName = (await readdir(assets)).find((name) => /^preview\.worker-.*\.js$/.test(name));
if (!bundleName) throw new Error('Run npm run build first.');
const harness = new URL(
  `data:text/javascript,${encodeURIComponent(`
  import { parentPort, workerData } from 'node:worker_threads';
  globalThis.self = globalThis;
  globalThis.postMessage = value => parentPort.postMessage(value);
  await import(workerData.bundle);
  parentPort.on('message', data => globalThis.onmessage({ data }));
  parentPort.postMessage({ready: true});
`)}`,
);

async function parse(kind, name, extra = {}) {
  const worker = new Worker(harness, { workerData: { bundle: new URL(bundleName, assets).href } });
  const timeout = setTimeout(() => void worker.terminate(), 15_000);
  try {
    await once(worker, 'message');
    const bytes = Uint8Array.from(
      await readFile(new URL(`../test-results/fixtures/${name}`, import.meta.url)),
    );
    const resultPromise = once(worker, 'message');
    worker.postMessage({ kind, name, bytes, ...extra }, [bytes.buffer]);
    const [result] = await resultPromise;
    if (result.error) throw new Error(result.error);
    return result;
  } finally {
    clearTimeout(timeout);
    await worker.terminate();
  }
}
const docx = await parse('docx', 'smoke.docx');
assert.match(docx.html, /瞬览 DOCX 中文解析测试/);
assert.match(docx.html, /<table>/);
const xlsx = await parse('xlsx', 'smoke.xlsx');
assert.equal(xlsx.sheets[0].rows[1][1], '12000');
assert.equal(xlsx.sheets[1].name, '汇总');
const pptx = await parse('pptx', 'smoke.pptx');
assert.equal(pptx.slides[1].title, '第二张幻灯片');
const archive = await parse('archive', 'smoke.docx');
assert.ok(archive.entries.some((entry) => entry.name === 'word/document.xml'));
const inside = await parse('archive-entry', 'smoke.docx', { entryName: 'word/document.xml' });
assert.match(new TextDecoder().decode(inside.data), /瞬览 DOCX 中文解析测试/);
const markdown = await parse('markdown', 'untrusted.md');
assert.match(markdown.html, /Safe heading/);
assert.equal((await parse('csv', '项目清单.csv')).sheets[0].rows[1][0], '布局优化');
assert.match((await parse('odt', '阅读笔记.odt')).html, /把时间留给内容/);
assert.equal((await parse('ods', '预算.ods')).sheets[1].rows[0][1], '2400');
assert.equal((await parse('odp', '概览.odp')).slides[1].title, '更多文件格式');
assert.equal((await parse('epub', '阅读时光.epub')).chapters[1].title, '第二章 · 下一段旅程');
assert.match((await parse('fb2', '阅读时光.fb2')).html, /<em>/);
assert.match(
  (await parse('notebook', '分析笔记.ipynb')).html,
  /<pre class="notebook-output">你好，Notebook/,
);

const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
assert.equal((await parse('dxf', '机械图纸.dxf')).drawing.paths.length, 5);
assert.equal((await parse('model', '四面体.stl')).positions.length, 36);
assert.equal((await parse('model', '四面体.obj')).positions.length, 36);
const tiff = (await parse('tiff', '渐变图像.tiff')).raster;
assert.equal(tiff.width, 320);
assert.equal(tiff.pixels.length, 320 * 220 * 4);
assert.match((await parse('html', '网页样式.html')).html, /display:grid/);
assert.match((await parse('text', 'Dockerfile.dev')).html, /hljs-keyword/);
const bytes = Uint8Array.from(
  await readFile(new URL('../test-results/fixtures/smoke.pdf', import.meta.url)),
);
const loading = getDocument({
  data: bytes,
  standardFontDataUrl: fileURLToPath(
    new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url),
  ).replaceAll('\\', '/'),
});
const pdf = await loading.promise;
assert.equal(pdf.numPages, 1);
const page = await pdf.getPage(1);
const text = (await page.getTextContent()).items.map((item) => item.str ?? '').join(' ');
assert.match(text, /SpacePreview PDF smoke test/);
const { createCanvas } = await import('@napi-rs/canvas');
const viewport = page.getViewport({ scale: 1 });
const canvas = createCanvas(viewport.width, viewport.height);
await page.render({ canvas, viewport }).promise;
await writeFile(
  new URL('../test-results/pdf-render.png', import.meta.url),
  canvas.toBuffer('image/png'),
);
await loading.destroy();
console.log(
  '21 production-engine smoke checks passed: DOCX, XLSX, PPTX, ZIP, ZIP entry, Markdown, CSV, ODT, ODS, ODP, EPUB, FB2, Notebook, DXF, STL, OBJ, TIFF, HTML, Dockerfile, PDF text, PDF canvas rendering.',
);
