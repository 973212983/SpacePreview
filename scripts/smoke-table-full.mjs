import { chromium, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { zipSync } from 'fflate';
import { openPreviewMenu, closePreviewMenu } from './preview-menu.mjs';

const rows = 20000;
const csv = Buffer.from(
  'Date,Agent,Automation,Kind,Model,MaxMode,Input,Output,Cache,Cost,Note,Marker\r\n' +
    Array.from({ length: rows }, (_, i) =>
      [
        `2026-10-10-${i + 1}`,
        '',
        '',
        'On-Demand',
        'test-model',
        'No',
        '0',
        '0',
        '0',
        '=1+1',
        '正文'.repeat(90),
        `row-${i + 1}`,
      ].join(','),
    ).join('\r\n'),
);
expect(csv.length).toBeGreaterThan(8 * 1024 * 1024);
await writeFile(new URL('../test-results/fixtures/完整表格.csv', import.meta.url), csv);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
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
  await page.addInitScript(() => {
    const read = Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer = async function () {
      if (this.size > 512 * 1024) await new Promise((resolve) => setTimeout(resolve, 200));
      return read.call(this);
    };
  });
  await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1423');
  await page.locator('input[type=file]').setInputFiles({
    name: '完整表格.csv',
    mimeType: 'text/csv',
    buffer: csv,
  });
  await expect(page.getByRole('status').locator('.spinner')).toBeVisible();
  await openPreviewMenu(page);
  await expect(page.locator('.content-toolbar')).toContainText('20001 行 · 12 列');
  await expect(page.locator('.content-toolbar')).not.toContainText('已截断');
  await closePreviewMenu(page);
  const scroll = page.locator('.workbook-scroll');
  const visibleRows = page.locator('.workbook-table tbody tr:not([aria-hidden])');
  await expect(visibleRows.first()).toContainText('Date');
  expect(await visibleRows.first().evaluate((row) => row.getBoundingClientRect().height)).toBe(32);
  for (const row of [5001, 15001]) {
    await scroll.evaluate((element, index) => {
      element.scrollTop = index * 32;
    }, row);
    await expect(
      visibleRows.locator('td').filter({ hasText: new RegExp(`^row-${row}$`) }),
    ).toBeVisible();
    expect(await visibleRows.count()).toBeLessThanOrEqual(50);
  }
  await scroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.scrollLeft = element.scrollWidth;
  });
  await expect(visibleRows.last().locator('th')).toHaveText('20001');
  await expect(visibleRows.last().locator('td').last()).toHaveText('row-20000');
  await expect(visibleRows.last().locator('td').last()).toBeInViewport();
  await page.screenshot({ path: 'test-results/table-full-tail.png' });
  await scroll.evaluate((element) => {
    element.scrollTop = 0;
    element.scrollLeft = 0;
  });
  await expect(visibleRows.first()).toContainText('Date');
  const wide = Array.from({ length: 125 }, (_, i) => `列-${i + 1}`).join('\t');
  await page.locator('input[type=file]').setInputFiles({
    name: '宽表格.tsv',
    mimeType: 'text/tab-separated-values',
    buffer: Buffer.from(wide),
  });
  await openPreviewMenu(page);
  await expect(page.locator('.content-toolbar')).toContainText('1 行 · 125 列');
  await closePreviewMenu(page);
  await expect(visibleRows.first().locator('td')).toHaveCount(125);
  await scroll.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  await expect(visibleRows.first().locator('td').last()).toHaveText('列-125');
  await expect(visibleRows.first().locator('td').last()).toBeInViewport();
  await page.locator('input[type=file]').setInputFiles({
    name: '表格内部预览.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(zipSync({ '完整表格.csv': csv })),
  });
  await page.locator('.archive-row').filter({ hasText: '完整表格.csv' }).dblclick();
  await expect(page.locator('.file-title strong')).toHaveText('完整表格.csv');
  await expect(page.locator('.workbook-table')).toBeVisible();
  await openPreviewMenu(page);
  await expect(page.locator('.content-toolbar')).toContainText('20001 行 · 12 列');
  await expect(page.locator('.content-toolbar')).not.toContainText('已截断');
  await closePreviewMenu(page);
  await scroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(visibleRows.last().locator('td').last()).toHaveText('row-20000');
  await page.getByTitle('返回列表 · ←', { exact: true }).click();
  await expect(page.locator('.archive-row').filter({ hasText: '完整表格.csv' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(errors).toEqual([]);
  console.log(
    'Full table passed: >8 MB CSV, all 20,001 rows, scroll beyond 5,000 and to final row, bounded DOM, 125-column TSV, loading animation, desktop CSP.',
  );
} finally {
  await browser.close();
}
