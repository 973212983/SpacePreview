import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { openPreviewMenu, closePreviewMenu } from './preview-menu.mjs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
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
  await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1423');
  const open = async (name) => {
    await page
      .locator('input[type=file]')
      .setInputFiles(fileURLToPath(new URL(`../test-results/fixtures/${name}`, import.meta.url)));
    await expect(page.locator('.file-title strong')).toHaveText(name);
  };
  await open('legacy.doc');
  await expect(page.locator('.document-paper')).toContainText('旧版 Word 中文标题');
  await expect(page.locator('.document-paper')).toContainText('第二段 UTF-16 文本');
  await open('legacy.ppt');
  await expect(page.locator('.slide-paper')).toContainText('第 1 页完整正文');
  await openPreviewMenu(page);
  await page.getByTitle('下一张幻灯片', { exact: true }).click();
  await closePreviewMenu(page);
  await expect(page.locator('.slide-paper')).toContainText('第 2 页完整正文');
  console.log('DOC/PPT real Office content PASS');
  for (const ext of ['wmf', 'emf']) {
    await open(`sample.${ext}`);
    await expect(page.locator('.preview-image')).toBeVisible({ timeout: 30000 });
    const svg = await page.locator('.preview-image').evaluate(async (image) => {
      const response = await fetch(image.src);
      const svg = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
      return {
        width: image.naturalWidth,
        shapes: svg.querySelectorAll('path,polygon,polyline,rect,ellipse,line,text,image').length,
      };
    });
    expect(svg.width).toBeGreaterThan(0);
    expect(svg.shapes).toBeGreaterThan(0);
    await page.screenshot({ path: `test-results/formats-${ext}.png` });
    console.log('vector', ext, 'PASS', svg.shapes, 'shapes');
  }
  expect(errors).toEqual([]);
} finally {
  await browser.close();
}
