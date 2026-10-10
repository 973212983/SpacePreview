import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { openPreviewMenu, closePreviewMenu } from './preview-menu.mjs';
import { fixture } from './pdf-pages-fixture.mjs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1423');
  for (const [index, path] of process.argv.slice(2).entries()) {
    const bytes = fs.readFileSync(path);
    const loading = getDocument({ data: Uint8Array.from(bytes) });
    const pdf = await loading.promise;
    const count = pdf.numPages;
    await loading.destroy();
    await page.locator('input[type=file]').setInputFiles(path);
    const pages = page.locator('.pdf-page');
    await expect(pages).toHaveCount(count, { timeout: 30000 });
    await expect(pages.first()).toHaveAttribute('data-rendered', 'true', { timeout: 30000 });
    for (const number of [...new Set([2, Math.ceil(count / 2), count])]) {
      const target = pages.nth(number - 1);
      await target.evaluate((element) => element.scrollIntoView({ block: 'start' }));
      await expect(target).toHaveAttribute('data-rendered', 'true', { timeout: 30000 });
      await expect(target.locator('canvas')).toBeInViewport();
      expect(
        await target.locator('canvas').evaluate((canvas) => canvas.width * canvas.height),
      ).toBeGreaterThan(10000);
      expect(
        await target.locator('canvas').evaluate((canvas) => {
          const pixels = canvas
            .getContext('2d')
            .getImageData(0, 0, canvas.width, canvas.height).data;
          for (let i = 0; i < pixels.length; i += 64)
            if (pixels[i + 3] && (pixels[i] < 230 || pixels[i + 1] < 230 || pixels[i + 2] < 230))
              return true;
          return false;
        }),
      ).toBe(true);
    }
    await pages.first().evaluate((element) => element.scrollIntoView({ block: 'start' }));
    await openPreviewMenu(page);
    await expect(page.getByLabel('PDF 当前页')).toHaveText(`1 / ${count}`);
    await page.getByTitle('下一页', { exact: true }).click();
    await expect(page.getByLabel('PDF 当前页')).toHaveText(`2 / ${count}`);
    await page.getByTitle('放大', { exact: true }).click();
    await expect(page.getByLabel('PDF 当前页')).toHaveText(`2 / ${count}`);
    await closePreviewMenu(page);
    await expect(pages.nth(1)).toHaveAttribute('data-rendered', 'true');
    await expect(pages.nth(1).locator('canvas')).toBeInViewport();
    expect(fs.readFileSync(path).equals(bytes)).toBe(true);
    console.log(
      `PDF ${index + 1}: ${count} continuous pages, later-page rendering, navigation, zoom and unchanged source passed.`,
    );
  }
  await page.locator('input[type=file]').setInputFiles(fileURLToPath(fixture));
  const pages = page.locator('.pdf-page');
  await expect(pages).toHaveCount(40);
  await expect(pages.first()).toHaveAttribute('data-rendered', 'true');
  await openPreviewMenu(page);
  await page.getByTitle('搜索 PDF', { exact: true }).click();
  await closePreviewMenu(page);
  await page.getByLabel('搜索 PDF 内容').fill('CONTINUOUS_PAGE_20');
  await page.locator('.pdf-sidebar > button').getByText('第 20 页', { exact: true }).click();
  await expect(pages.nth(19)).toHaveAttribute('data-rendered', 'true');
  await expect(pages.nth(19).locator('canvas')).toBeInViewport();
  await openPreviewMenu(page);
  await expect(page.getByLabel('PDF 当前页')).toHaveText('20 / 40');
  await page.getByTitle('PDF 目录', { exact: true }).click();
  await closePreviewMenu(page);
  await page.locator('.pdf-sidebar > button').getByText('Saved last page').click();
  await expect(pages.last()).toHaveAttribute('data-rendered', 'true');
  await expect(pages.last().locator('canvas')).toBeInViewport();
  await openPreviewMenu(page);
  await expect(page.getByLabel('PDF 当前页')).toHaveText('40 / 40');
  for (let i = 0; i < 8; i++) await page.getByTitle('放大', { exact: true }).click();
  await closePreviewMenu(page);
  await expect(pages.last()).toHaveAttribute('data-rendered', 'true');
  const bitmap = await pages
    .last()
    .locator('canvas')
    .evaluate((canvas) => canvas.width * canvas.height);
  expect(bitmap).toBeLessThan(16_020_000);
  expect(bitmap).toBeGreaterThan(10_000_000);
  await expect
    .poll(() =>
      pages
        .first()
        .locator('canvas')
        .evaluate((canvas) => canvas.width),
    )
    .toBe(0);
  expect(await page.locator('.pdf-page[data-rendered=true]').count()).toBeLessThan(8);
  await pages.first().evaluate((element) => element.scrollIntoView({ block: 'start' }));
  await expect(pages.first()).toHaveAttribute('data-rendered', 'true');
  await expect(pages.first().locator('canvas')).toBeInViewport();
  await expect(page.getByRole('alert')).toHaveCount(0);
  console.log(
    '40-page PDF: mixed page sizes, search/bookmark navigation, rapid zoom, bounded bitmaps, offscreen release and return-to-first rendering passed.',
  );
  expect(errors).toEqual([]);
} finally {
  await browser.close();
}
