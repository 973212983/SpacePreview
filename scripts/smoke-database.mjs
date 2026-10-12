import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { openPreviewMenu } from './preview-menu.mjs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1423');
  await page.evaluate(() => {
    window.databaseReads = [];
    const slice = Blob.prototype.slice;
    Blob.prototype.slice = function (start, end, type) {
      window.databaseReads.push({ start, end });
      return slice.call(this, start, end, type);
    };
  });
  const input = page.locator('input[type=file]');
  const cache = process.env.DATABASE_TEST_FILE
    ? await readFile(process.env.DATABASE_TEST_FILE)
    : Buffer.from([0x69, 0x70, 0x02, 0x62]);
  await input.setInputFiles({
    name: 'cache.db',
    mimeType: 'application/octet-stream',
    buffer: cache,
  });
  await expect(page.getByRole('alert')).toContainText('文件头不是标准 SQLite');
  await expect(page.locator('.database-tables')).toHaveCount(0);
  await expect(page.locator('.spinner')).toHaveCount(0);
  expect(await page.evaluate(() => window.databaseReads)).toEqual([{ start: 0, end: 16 }]);
  await page.screenshot({ path: 'test-results/database-unsupported.png' });
  await openPreviewMenu(page);
  await page.getByRole('button', { name: '文件信息', exact: true }).click();
  await expect(page.locator('.binary-preview')).toContainText('cache.db');
  console.log(
    'Non-SQLite .db PASS: clear explanation, header-only read, file information available.',
  );

  const sqlite = await readFile('test-results/fixtures/sample.sqlite');
  await input.setInputFiles({
    name: 'valid.db',
    mimeType: 'application/octet-stream',
    buffer: sqlite,
  });
  await page.locator('.database-tables button').filter({ hasText: '中文表' }).click();
  await expect(page.locator('.database-grid')).toContainText('记录 200');
  await openPreviewMenu(page);
  await page.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(page.locator('.database-grid')).toContainText('记录 400');
  await page.getByLabel('关闭更多选项').click({ position: { x: 10, y: 100 } });
  const corrupt = Buffer.from(sqlite);
  corrupt[100] = 0;
  await input.setInputFiles({
    name: 'damaged.db',
    mimeType: 'application/octet-stream',
    buffer: corrupt,
  });
  await expect(page.getByRole('alert')).toContainText('已损坏');
  expect(errors).toEqual([]);
  console.log('SQLite PASS: real tables/pages readable, damaged structure explained in Chinese.');
} finally {
  await browser.close();
}
