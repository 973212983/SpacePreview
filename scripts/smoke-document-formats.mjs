import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { write, utils, set_cptable } from 'xlsx';
import { gzipSync, strToU8, zipSync } from 'fflate';
import { openPreviewMenu, closePreviewMenu } from './preview-menu.mjs';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
set_cptable(await import('xlsx/dist/cpexcel.full.mjs'));
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errors = [],
    remote = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.url().includes('example.invalid')) remote.push(request.url());
  });
  const csp = JSON.parse(
    await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'),
  ).app.security.csp;
  await page.route('**/', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'content-security-policy': csp },
    });
  });
  await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1423');
  const open = async (name, buffer) => {
    await page
      .locator('input[type=file]')
      .setInputFiles({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(buffer) });
    await expect(page.locator('.file-title strong')).toHaveText(name);
  };
  const book = utils.book_new();
  utils.book_append_sheet(
    book,
    utils.aoa_to_sheet([
      ['姓名', '金额'],
      ['中文工作簿', 123],
      ...Array.from({ length: 3100 }, (_, i) => [`记录 ${i}`, i]),
    ]),
    '中文表',
  );
  for (const [ext, bookType] of [
    ['xls', 'biff8'],
    ['xlsb', 'xlsb'],
    ['dbf', 'dbf'],
    ['dif', 'dif'],
    ['slk', 'sylk'],
  ]) {
    await open(
      `sample.${ext}`,
      write(book, { type: 'buffer', bookType, codepage: ext === 'dbf' ? 936 : 65001 }),
    );
    await expect(page.locator('.workbook-table')).toBeVisible();
    if (ext === 'slk') await expect(page.locator('.workbook-table')).toContainText('123');
    else await expect(page.locator('.workbook-table')).toContainText('中文工作簿');
    await openPreviewMenu(page);
    await expect(page.locator('.dropdown')).toContainText('3102 行');
    await closePreviewMenu(page);
    console.log('workbook', ext, 'PASS');
  }
  await open(
    'sample.adoc',
    strToU8(
      '= 文档标题\n\n== 第一章\n\n中文 *加粗* 文本。\n\n== 第二章\n\ninclude::https://example.invalid/secret[]',
    ),
  );
  await expect(page.locator('.document-paper')).toContainText('中文');
  await expect(page.locator('.reading-outline nav button')).toHaveCount(2);
  await expect(page.locator('.document-paper strong')).toHaveText('加粗');
  console.log('asciidoc PASS');
  for (const ext of ['gv', 'dot']) {
    await open(`sample.${ext}`, strToU8('digraph { a [label="开始"]; b [label="完成"]; a -> b; }'));
    await expect(page.getByLabel('Graphviz 图表预览').locator('svg')).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByLabel('Graphviz 图表预览')).toContainText('完成');
    console.log('graphviz', ext, 'PASS');
  }
  await open('rules.mdc', strToU8('# Cursor 规则\n\nMarkdown 正文'));
  await expect(page.locator('.document-paper')).toContainText('Markdown 正文');
  await open('sample.mmd', strToU8('# MultiMarkdown 文档\n\n完整正文'));
  await expect(page.locator('.document-paper')).toContainText('完整正文');
  await open('sample.mermaid', strToU8('flowchart LR\n A[开始] --> B[完成]'));
  await expect(page.getByLabel('Mermaid 图表预览').locator('svg')).toBeVisible({ timeout: 30000 });
  await expect(page.getByLabel('Mermaid 图表预览')).toContainText('完成');
  console.log('mermaid PASS');
  const animation = {
    v: '5.7.4',
    fr: 30,
    w: 100,
    h: 100,
    ip: 0,
    op: 60,
    assets: [{ id: 'remote', u: 'https://example.invalid/', p: 'tracker.png' }],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 1,
        nm: 'solid',
        sr: 1,
        sw: 50,
        sh: 50,
        sc: '#4f80d5',
        ks: {
          o: { a: 0, k: 100 },
          r: { a: 0, k: 0 },
          p: { a: 0, k: [50, 50, 0] },
          a: { a: 0, k: [25, 25, 0] },
          s: { a: 0, k: [100, 100, 100] },
        },
        ao: 0,
        ip: 0,
        op: 60,
        st: 0,
        bm: 0,
      },
    ],
  };
  for (const [name, bytes] of [
    ['sample.lottie.json', strToU8(JSON.stringify(animation))],
    ['sample.tgs', gzipSync(strToU8(JSON.stringify(animation)))],
    [
      'sample.lottie',
      zipSync({
        'manifest.json': strToU8('{"animations":[{"id":"one"}]}'),
        'animations/one.json': strToU8(JSON.stringify(animation)),
      }),
    ],
  ]) {
    await open(name, bytes);
    await expect(page.getByLabel('Lottie 动画预览').locator('svg')).toBeVisible();
    await expect(page.locator('.preview-message')).toHaveCount(0);
    await openPreviewMenu(page);
    await page.getByRole('button', { name: '暂停', exact: true }).click();
    await expect(page.getByRole('button', { name: '播放', exact: true })).toBeEnabled();
    await closePreviewMenu(page);
    console.log('animation', name, 'PASS');
  }
  await page.screenshot({ path: 'test-results/formats-animation.png' });
  expect(remote).toEqual([]);
  expect(errors).toEqual([]);
} finally {
  await browser.close();
}
