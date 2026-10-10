import { chromium, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { zipSync, strToU8 } from 'fflate';
import { openPreviewMenu, closePreviewMenu } from './preview-menu.mjs';

const child = zipSync({ 'inside.md': strToU8('# 嵌套文档\n\n返回应逐层回到原列表。') });
const entries = {
  'docs/readme.txt': strToU8('压缩包内部正文，预览后返回原目录。'),
  'docs/nested.zip': child,
  'photo.png': new Uint8Array([137, 80, 78, 71]),
  'tools/editor.ts': strToU8('const readable = true;'),
};
for (let i = 0; i < 215; i++)
  entries[`items/file-${String(i).padStart(3, '0')}.txt`] = strToU8(`第 ${i} 份内容`);
const archive = Buffer.from(zipSync(entries));
await writeFile(new URL('../test-results/fixtures/浏览体验.zip', import.meta.url), archive);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
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
  const input = page.locator('input[type=file]');
  await input.setInputFiles({ name: '浏览体验.zip', mimeType: 'application/zip', buffer: archive });
  const list = () => page.locator('.archive-preview:visible .archive-list');
  const row = (name) => list().locator('.archive-row').filter({ hasText: name });
  await expect(list().locator('.archive-row')).toHaveCount(4);
  await expect(list().locator('.folder-type-icon')).toHaveCount(3);
  await expect(list().locator('[data-file-kind=image]')).toHaveCount(1);
  expect((await page.locator('.titlebar').boundingBox()).height).toBe(36);
  const rowBounds = await row('docs').boundingBox();
  await page.mouse.move(rowBounds.x + rowBounds.width / 2, rowBounds.y + rowBounds.height / 2);
  await page.mouse.down();
  await expect(row('docs')).toHaveCSS('transform', 'none');
  expect(await row('docs').boundingBox()).toEqual(rowBounds);
  await page.mouse.up();
  await expect(row('docs')).toHaveCSS('transform', 'none');
  expect(await row('docs').boundingBox()).toEqual(rowBounds);
  await expect(row('docs')).toHaveAttribute('aria-selected', 'true');
  await row('docs').press('ArrowDown');
  await expect(list().locator('.archive-row.selected')).toHaveCSS('transform', 'none');
  await row('docs').click();
  await expect(page.locator('.file-title strong')).toHaveText('浏览体验.zip');
  await openPreviewMenu(page);
  await page.getByRole('button', { name: '打开文件夹', exact: true }).click();
  await closePreviewMenu(page);
  await expect(list().locator('.archive-row')).toHaveCount(2);
  await row('readme.txt').dblclick();
  await expect(page.locator('.plain-text .code-scroll pre')).toHaveCSS('font-size', '18px');
  await expect(page.locator('.code-scroll')).toContainText('压缩包内部正文');
  await page.locator('.archive-back-button').click();
  await expect(list().locator('.archive-row')).toHaveCount(2);
  await expect(row('readme.txt')).toHaveAttribute('aria-selected', 'true');
  await row('nested.zip').dblclick();
  await expect(list().locator('.archive-row')).toHaveCount(1);
  await row('inside.md').dblclick();
  await expect(page.locator('.document-paper')).toContainText('嵌套文档');
  await page.locator('.archive-back-button').click();
  await expect(page.locator('.file-title strong')).toHaveText('nested.zip');
  await page.locator('.archive-back-button').click();
  await expect(page.locator('.file-title strong')).toHaveText('浏览体验.zip');
  await expect(list().locator('.archive-row')).toHaveCount(2);
  await page.getByRole('button', { name: '压缩包根目录', exact: true }).click();
  await row('items').dblclick();
  await page.getByLabel('压缩包下一页').click();
  await expect(row('file-100.txt')).toBeVisible();
  await list().evaluate((el) => (el.scrollTop = 1200));
  const scrolled = await list().evaluate((el) => el.scrollTop);
  await row('file-140.txt').dblclick();
  await expect(page.locator('.code-scroll')).toContainText('第 140 份内容');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.archive-paging:visible')).toContainText('2 / 3');
  await expect(row('file-140.txt')).toBeFocused();
  expect(await list().evaluate((el) => el.scrollTop)).toBe(scrolled);
  await openPreviewMenu(page);
  await page.getByLabel('筛选压缩包内容').fill('file-214');
  await closePreviewMenu(page);
  await row('file-214').click();
  await row('file-214').press('Enter');
  await expect(page.locator('.code-scroll')).toContainText('第 214 份内容');
  await page.locator('.archive-back-button').click();
  await openPreviewMenu(page);
  await expect(page.getByLabel('筛选压缩包内容')).toHaveValue('file-214');
  await page.getByLabel('筛选压缩包内容').fill('');
  await closePreviewMenu(page);
  await list().getByRole('columnheader', { name: '名称', exact: false }).click();
  await expect(list().locator('.archive-row').first()).toContainText('file-214.txt');
  await page.screenshot({ path: 'test-results/polish-archive.png' });
  await input.setInputFiles({
    name: 'firmware.bin',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(Array.from({ length: 512 }, (_, i) => i % 256)),
  });
  await expect(page.locator('.binary-preview .file-type-icon')).toBeVisible();
  await expect(page.locator('.hex-row:not(.hex-column-heading)')).toHaveCount(8);
  await page.getByRole('button', { name: '512 字节', exact: true }).click();
  await expect(page.locator('.hex-row:not(.hex-column-heading)')).toHaveCount(32);
  await expect(page.locator('.hex-signature')).toHaveCount(9);
  expect(
    await page
      .locator('.binary-preview')
      .evaluate((el) => getComputedStyle(el, '::-webkit-scrollbar').width),
  ).toBe('5px');
  await page.screenshot({ path: 'test-results/polish-binary.png' });
  await page.setViewportSize({ width: 640, height: 480 });
  await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/polish-binary-small-dark.png' });
  await input.setInputFiles({ name: '浏览体验.zip', mimeType: 'application/zip', buffer: archive });
  await row('docs').dblclick();
  await page.screenshot({ path: 'test-results/polish-archive-small-dark.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  console.log(
    'Polish UI passed: 36px header, 5px scrollbar, larger fonts, colored icons, Explorer selection/open/sort, nested preview/back, preserved folder/filter/page/scroll, binary byte colors, small dark UI, native CSP.',
  );
} finally {
  await browser.close();
}
