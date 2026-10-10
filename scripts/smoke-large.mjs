import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import './large-fixtures.mjs';
import { openPreviewMenu, closePreviewMenu } from './preview-menu.mjs';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const read = Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer = async function () {
      if (this.size > 512 * 1024) await new Promise((resolve) => setTimeout(resolve, 700));
      return read.call(this);
    };
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
  const open = async (name) =>
    page
      .locator('input[type=file]')
      .setInputFiles(fileURLToPath(new URL(`../test-results/fixtures/${name}`, import.meta.url)));
  await open('large.zip');
  await expect(page.locator('.archive-row')).toHaveCount(3);
  await expect(page.locator('.archive-row').filter({ hasText: 'large.bin' })).toBeDisabled();
  await page.locator('.archive-row').filter({ hasText: 'items' }).dblclick();
  await expect(page.locator('.archive-row')).toHaveCount(100);
  await page.getByLabel('压缩包下一页').click();
  await expect(page.locator('.archive-row').first()).toContainText('file-100.txt');
  await openPreviewMenu(page);
  await page.getByLabel('筛选压缩包内容').fill('file-214');
  await expect(page.locator('.archive-row')).toHaveCount(1);
  await page.getByLabel('筛选压缩包内容').fill('');
  await closePreviewMenu(page);
  await page.getByRole('button', { name: '压缩包根目录', exact: true }).click();
  await page.locator('.archive-row').filter({ hasText: 'docs' }).dblclick();
  await page.screenshot({ path: 'test-results/archive-ranges.png' });
  await page.locator('.archive-row').filter({ hasText: 'readme.txt' }).dblclick();
  await expect(page.locator('.code-scroll')).toContainText('大压缩包内部中文预览');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.archive-preview')).toBeVisible();
  await open('large.log');
  await expect(page.getByRole('status')).toContainText('正在加载完整文件');
  await expect(page.getByRole('status').locator('.spinner')).toBeVisible();
  await expect(page.locator('.code-scroll')).toContainText('中文日志记录');
  await expect(page.locator('.text-page-tools, .text-pages')).toHaveCount(0);
  await openPreviewMenu(page);
  await expect(page.locator('.content-toolbar')).toContainText('80001 行');
  await expect(page.locator('.code-scroll')).toContainText('文件末尾标记');
  await page.getByLabel('查找文本').fill('文件末尾标记');
  await expect(page.locator('.search small')).toHaveText('1');
  await expect.poll(() => page.evaluate(() => CSS.highlights.get('text-search')?.size)).toBe(1);
  await closePreviewMenu(page);
  await page
    .locator('.code-scroll')
    .evaluate((element) => (element.scrollTop = element.scrollHeight));
  const tailVisible = await page.locator('.continuous-content').evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.setStart(element.lastChild, element.lastChild.textContent.length - '文件末尾标记'.length);
    const tail = range.getBoundingClientRect(),
      viewport = element.closest('.code-scroll').getBoundingClientRect();
    return tail.top >= viewport.top && tail.bottom <= viewport.bottom;
  });
  expect(tailVisible).toBe(true);
  await page.screenshot({ path: 'test-results/large-text-tail.png' });
  await open('large.ts');
  await expect(page.locator('.continuous-content .hljs-keyword').last()).toHaveText('const');
  await openPreviewMenu(page);
  await expect(page.locator('.content-toolbar')).toContainText('12001 行');
  await page.getByLabel('查找文本').fill('const finalMarker');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const highlight = CSS.highlights.get('text-search');
        return highlight ? [...highlight].map((range) => range.toString()) : [];
      }),
    )
    .toEqual(['const finalMarker']);
  await closePreviewMenu(page);
  await open('large-utf16.txt');
  await expect
    .poll(() =>
      page
        .locator('.continuous-content')
        .textContent()
        .then((text) => text?.endsWith('UTF16 文件末尾标记')),
    )
    .toBe(true);
  await openPreviewMenu(page);
  await expect(page.locator('.content-toolbar')).toContainText('80001 行');
  await closePreviewMenu(page);
  await open('large.md');
  await expect(page.locator('.document-paper')).toContainText('完整 Markdown 末尾标记', {
    timeout: 30000,
  });
  await expect(page.locator('.reading-outline nav button').last()).toHaveText('文档结尾');
  await page.locator('.reading-outline nav button').last().click();
  await page.screenshot({ path: 'test-results/large-markdown-tail.png' });
  await open('large.docx');
  const doc = page.frameLocator('iframe[title="Word 原样预览"]');
  await expect(doc.locator('section.docx')).toHaveCount(2, { timeout: 30000 });
  await expect(doc.locator('body')).toContainText('保持文档原有的表达');
  await expect
    .poll(() =>
      doc
        .locator('img')
        .first()
        .evaluate((image) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(page.locator('.document-note')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/large-word-pages.png' });
  await open('large-33mb.log');
  await expect
    .poll(
      () =>
        page
          .locator('.continuous-content')
          .textContent()
          .then((text) => text?.endsWith('超过 32 MB 文件末尾标记')),
      { timeout: 30000 },
    )
    .toBe(true);
  await openPreviewMenu(page);
  await expect(page.locator('.content-toolbar')).toContainText('8501 行');
  await closePreviewMenu(page);
  await open('large.log');
  await expect(page.getByRole('status')).toBeVisible();
  await open('license.dat');
  await expect(page.locator('.code-scroll')).toContainText('License information');
  await page.waitForTimeout(1000);
  await expect(page.locator('.continuous-content')).toHaveCount(0);
  await page.setViewportSize({ width: 640, height: 480 });
  await open('large.zip');
  await expect(page.locator('.archive-row')).toHaveCount(3);
  await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
  await page.screenshot({ path: 'test-results/archive-small-dark.png' });
  expect(errors).toEqual([]);
  console.log(
    'Large-file UI passed: complete 80,001-line text/UTF16, full search/tail scroll, full Markdown, 40MB Word pages/images, ZIP internal preview/back, no text paging, native CSP.',
  );
} finally {
  await browser.close();
}
