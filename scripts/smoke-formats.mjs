import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { openPreviewMenu, closePreviewMenu } from './preview-menu.mjs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
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
  const open = async (name) => {
    await page
      .locator('input[type=file]')
      .setInputFiles(fileURLToPath(new URL(`../test-results/fixtures/${name}`, import.meta.url)));
    await expect(page.locator('.file-title strong')).toHaveText(name);
  };
  for (const ext of [
    'psd',
    'psb',
    'dds',
    'exr',
    'hdr',
    'jp2',
    'jxl',
    'qoi',
    'tga',
    'pcx',
    'ppm',
    'pbm',
    'pgm',
    'pam',
    'miff',
    'xbm',
    'xpm',
    'fits',
    'cur',
    'heic',
  ]) {
    await open(`sample.${ext}`);
    await expect(page.locator('.preview-image')).toBeVisible({ timeout: 120000 });
    expect(
      await page.locator('.preview-image').evaluate((image) => image.naturalWidth),
    ).toBeGreaterThan(0);
    console.log('image', ext, 'PASS');
  }
  await page.screenshot({ path: 'test-results/formats-heic.png' });
  for (const ext of ['kdc', 'cr2']) {
    await open(`camera.${ext}`);
    await expect(page.locator('.preview-image')).toBeVisible({ timeout: 120000 });
    console.log('camera', ext, 'PASS');
  }
  for (const name of ['archive.tar', 'archive.tgz', 'archive.bz2', 'archive.xz', 'archive.lz']) {
    await open(name);
    await expect(page.locator('.archive-list')).toBeVisible({ timeout: 30000 });
    await page
      .locator('.archive-row')
      .filter({ has: page.getByText('目录', { exact: true }) })
      .dblclick();
    await page.locator('.archive-row').filter({ hasText: 'hello.txt' }).dblclick();
    await expect(page.locator('.code-scroll')).toContainText('压缩包里面的中文内容');
    await page.locator('.archive-back-button').click();
    await expect(page.locator('.archive-row.selected')).toContainText('hello.txt');
    await page.locator('.archive-row').filter({ hasText: 'sample.psd' }).dblclick();
    await expect(page.locator('.preview-image')).toBeVisible({ timeout: 30000 });
    console.log('archive', name, 'PASS');
  }
  for (const ext of ['bz2', 'xz']) {
    await open(`hello.txt.${ext}`);
    await expect(page.locator('.archive-list')).toBeVisible({ timeout: 30000 });
    await page.locator('.archive-row').filter({ hasText: 'hello.txt' }).dblclick();
    await expect(page.locator('.code-scroll')).toContainText('独立压缩流完整中文内容');
    console.log('standalone', ext, 'PASS');
  }
  for (const name of [
    'archive.7z',
    'sample.rar',
    'sample-rar5.rar',
    'archive.zst',
    'archive.lzma',
  ]) {
    await open(name);
    await expect(page.locator('.archive-list')).toBeVisible({ timeout: 30000 });
    const row = page
      .locator('.archive-row')
      .filter({ hasNot: page.locator('.folder-type-icon') })
      .first();
    await row.dblclick();
    await expect(page.locator('.archive-back-button')).toBeVisible();
    await expect(
      page.locator('.preview-layer:not([hidden]) .preview-message[role=alert]'),
    ).toHaveCount(0);
    console.log('archive', name, 'PASS');
  }
  await open('hello.txt.gz');
  await expect(page.locator('.archive-list')).toBeVisible({ timeout: 30000 });
  await page.locator('.archive-row').first().dblclick();
  await expect(page.locator('.code-scroll')).toContainText('独立 GZIP 完整内容');
  await open('sample.sqlite');
  await page.getByRole('button', { name: '中文表 表', exact: true }).click();
  await expect(page.locator('.database-grid')).toContainText('记录 200');
  await openPreviewMenu(page);
  await page.getByRole('button', { name: '下一页', exact: true }).click();
  await closePreviewMenu(page);
  await expect(page.locator('.database-grid')).toContainText('记录 400');
  await openPreviewMenu(page);
  await page.getByRole('button', { name: '下一页', exact: true }).click();
  await closePreviewMenu(page);
  await expect(page.locator('.database-grid')).toContainText('记录 405');
  await openPreviewMenu(page);
  await page.getByRole('button', { name: '查看表结构', exact: true }).click();
  await closePreviewMenu(page);
  await expect(page.locator('.database-schema')).toContainText('CREATE TABLE');
  await page.screenshot({ path: 'test-results/formats-database.png' });
  await open('sample.ttf');
  await expect(page.getByLabel('字体预览文本')).toBeVisible();
  await expect(page.locator('.font-glyphs span').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/formats-font.png' });
  await open('sample.eml');
  await expect(page.locator('.mail-header h1')).toHaveText('邮件预览');
  await expect(page.frameLocator('iframe').locator('h1')).toHaveText('中文邮件正文');
  await expect(page.frameLocator('iframe').locator('script')).toHaveCount(0);
  await page.getByTitle('预览附件', { exact: true }).click();
  await expect(page.locator('.code-scroll')).toContainText('附件完整内容');
  await open('sample.msg');
  await expect(page.locator('.mail-header h1')).toBeVisible();
  await expect(page.locator('.mail-header')).toContainText('Hello');
  await page.screenshot({ path: 'test-results/formats-mail.png' });
  expect(remote).toEqual([]);
  expect(errors).toEqual([]);
  console.log('Database, font, mail, attachment, CSP: PASS');
} finally {
  await browser.close();
}
