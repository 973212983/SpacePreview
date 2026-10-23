import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import './reading-fixtures.mjs';

const browser = process.env.CDP_URL
  ? await chromium.connectOverCDP(process.env.CDP_URL, { timeout: 10000 })
  : await chromium.launch({ channel: 'msedge', headless: true, timeout: 15000 });
try {
  const page = process.env.CDP_URL
    ? browser.contexts()[0].pages().find((page) => /localhost:1420|127\.0\.0\.1:1420/.test(page.url()))
    : await browser.newPage();
  if (!page) throw new Error('Desktop development page not found');
  if (!process.env.CDP_URL) await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1420');
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Inject recoverable I/O failures without replacing or modifying any document.
  await page.evaluate(() => {
    const fetchFile = window.fetch;
    window.fetch = function (input, init) {
      if (window.failPdfRead && String(input).startsWith('blob:')) {
        window.failPdfRead = false;
        return Promise.reject(new TypeError('Simulated PDF read failure'));
      }
      return fetchFile.call(this, input, init);
    };
    const read = Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer = function () {
      if (window.failWordRead) {
        window.failWordRead = false;
        return Promise.reject(new Error('Simulated Word read failure'));
      }
      return read.call(this);
    };
    window.restoreDocumentReads = () => {
      window.fetch = fetchFile;
      Blob.prototype.arrayBuffer = read;
    };
  });
  try {
    const open = (name, buffer) => page.locator('input[type=file]').setInputFiles({
      name, buffer, mimeType: 'application/octet-stream',
    });
    await page.evaluate(() => { window.failPdfRead = true; });
    await open('retry.pdf', await readFile('test-results/fixtures/smoke.pdf'));
    await expect(page.locator('.preview-message')).toContainText('Simulated PDF read failure');
    await expect(page.locator('.preview-message')).not.toContainText('文件损坏');
    await page.getByRole('button', { name: '重新加载', exact: true }).click();
    await expect(page.locator('.pdf-page[data-rendered="true"]')).toHaveCount(1, { timeout: 20000 });
    await expect(page.locator('.preview-message')).toHaveCount(0);
    await page.evaluate(() => { window.failWordRead = true; });
    await open('retry.docx', await readFile('test-results/fixtures/样式文档.docx'));
    await expect(page.getByRole('alert')).toContainText('Simulated Word read failure');
    await page.getByRole('button', { name: '重新加载', exact: true }).click();
    const frame = page.frameLocator('iframe[title="Word 原样预览"]');
    await expect(frame.locator('section.docx')).toHaveCount(2, { timeout: 20000 });
    await expect(page.locator('.word-status')).toHaveCount(0);
    await expect(frame.locator('img')).toHaveCount(1);
    await expect.poll(() => frame.locator('img').evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
    // A second failure must be recoverable without retaining the prior parsed resource cache.
    await page.evaluate(() => { window.failWordRead = true; });
    await open('retry-again.docx', await readFile('test-results/fixtures/样式文档.docx'));
    await expect(page.getByRole('alert')).toContainText('Simulated Word read failure');
    await page.getByRole('button', { name: '重新加载', exact: true }).click();
    await expect(frame.locator('section.docx')).toHaveCount(2, { timeout: 20000 });
    await expect(page.locator('.word-status')).toHaveCount(0);
    expect(errors).toEqual([]);
    console.log('PDF and Word injected read failures recover on retry; pages and Word images render.');
  } finally {
    await page.evaluate(() => window.restoreDocumentReads());
  }
} finally {
  await browser.close();
}
