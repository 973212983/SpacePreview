import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fixture } from './pdf-pages-fixture.mjs';
import { openPreviewMenu, closePreviewMenu } from './preview-menu.mjs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write'],
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1423');
  await page.locator('input[type=file]').setInputFiles(fileURLToPath(fixture));
  const pages = page.locator('.pdf-page');
  const marker = pages.first().locator('.pdf-text-layer span', { hasText: /^CONTINUOUS_PAGE_1$/ });
  await expect(marker).toBeVisible();
  const copyByMouse = async (span, expected) => {
    await span.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    const box = await span.boundingBox();
    await page.mouse.move(box.x + 1, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();
    const selected = await page.evaluate(() => window.getSelection().toString());
    expect(selected.trim()).toBe(expected);
    await page.keyboard.press('Control+c');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.replaceAll('\r\n', '\n')).toBe(selected);
  };
  await copyByMouse(marker, 'CONTINUOUS_PAGE_1');
  const original = await marker.boundingBox();
  await openPreviewMenu(page);
  await page.getByTitle('放大', { exact: true }).click();
  await closePreviewMenu(page);
  await expect
    .poll(async () => (await marker.boundingBox()).width / original.width)
    .toBeCloseTo(1.25, 1);
  await copyByMouse(marker, 'CONTINUOUS_PAGE_1');
  const second = pages.nth(1).locator('.pdf-text-layer span', { hasText: /^CONTINUOUS_PAGE_2$/ });
  await pages.nth(1).evaluate((element) => element.scrollIntoView({ block: 'start' }));
  await copyByMouse(second, 'CONTINUOUS_PAGE_2');
  await page.evaluate(() => {
    const first = document.querySelector('[data-pdf-page="1"] .pdf-text-layer span');
    const last = document.querySelector('[data-pdf-page="2"] .pdf-text-layer span');
    const range = document.createRange();
    range.setStart(first.firstChild, 0);
    range.setEnd(last.firstChild, last.textContent.length);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  });
  await page.keyboard.press('Control+c');
  const acrossPages = await page.evaluate(() => navigator.clipboard.readText());
  expect(acrossPages).toContain('CONTINUOUS_PAGE_1');
  expect(acrossPages).toContain('CONTINUOUS_PAGE_2');
  for (const number of [3, 4, 5]) {
    const target = pages.nth(number - 1);
    await target.evaluate((element) => element.scrollIntoView({ block: 'start' }));
    const span = target.locator('.pdf-text-layer span', { hasText: `CONTINUOUS_PAGE_${number}` });
    await expect(span).toBeVisible();
    expect(
      await span.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const canvas = element.closest('.pdf-page').querySelector('canvas');
        const pageBox = canvas.getBoundingClientRect();
        const scaleX = canvas.width / pageBox.width,
          scaleY = canvas.height / pageBox.height;
        const x = Math.max(0, Math.floor((box.left - pageBox.left) * scaleX));
        const y = Math.max(0, Math.floor((box.top - pageBox.top) * scaleY));
        const width = Math.min(canvas.width - x, Math.ceil(box.width * scaleX));
        const height = Math.min(canvas.height - y, Math.ceil(box.height * scaleY));
        if (width <= 0 || height <= 0) return false;
        const pixels = canvas.getContext('2d').getImageData(x, y, width, height).data;
        let ink = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (pixels[i + 3] && (pixels[i] < 180 || pixels[i + 1] < 180 || pixels[i + 2] < 180))
            ink++;
        return ink > 20;
      }),
    ).toBe(true);
    await span.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    });
    await page.keyboard.press('Control+c');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `CONTINUOUS_PAGE_${number}`,
    );
  }
  await pages.last().evaluate((element) => element.scrollIntoView({ block: 'start' }));
  await expect.poll(() => pages.first().locator('.pdf-text-layer span').count()).toBe(0);
  await pages.first().evaluate((element) => element.scrollIntoView({ block: 'start' }));
  await copyByMouse(marker, 'CONTINUOUS_PAGE_1');
  for (const [index, path] of process.argv.slice(2).entries()) {
    const bytes = fs.readFileSync(path);
    await page.locator('input[type=file]').setInputFiles(path);
    for (const number of [1, 2]) {
      const target = page.locator(`.pdf-page[data-pdf-page="${number}"]`);
      await target.evaluate((element) => element.scrollIntoView({ block: 'start' }));
      const span = target.locator('.pdf-text-layer span').filter({ hasText: /\S/ }).first();
      await expect(span).toBeVisible({ timeout: 30000 });
      const expected = await span.textContent();
      await span.evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
      });
      await page.keyboard.press('Control+c');
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
      expect(await span.evaluate((element) => getComputedStyle(element).fontSize)).not.toBe('0px');
    }
    expect(fs.readFileSync(path).equals(bytes)).toBe(true);
    console.log(
      `Private PDF ${index + 1}: first/second-page text selection and clipboard content passed; source unchanged.`,
    );
  }
  expect(errors).toEqual([]);
  console.log(
    'PDF copy passed: mouse selection and Ctrl+C, 125% text alignment at DPR 2, landscape page, offscreen release and return rendering.',
  );
} finally {
  await browser.close();
}
