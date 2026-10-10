import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import './reading-fixtures.mjs';
import { openPreviewMenu, closePreviewMenu } from './preview-menu.mjs';

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
  // Include native window buttons in width checks without requiring a desktop driver.
  await page.addInitScript(() => {
    let id = 0,
      maximized = false;
    window.isTauri = true;
    window.nativeCalls = [];
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
    window.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
      transformCallback() {
        return ++id;
      },
      unregisterCallback() {},
      async invoke(command) {
        window.nativeCalls.push(command);
        if (command === 'agent_status') return { supported: true, enabled: true, running: true };
        if (command === 'initial_paths') return { paths: [], text: false };
        if (command === 'plugin:event|listen') return ++id;
        if (command === 'plugin:window|toggle_maximize') maximized = !maximized;
        if (command === 'plugin:window|is_maximized') return maximized;
        if (command === 'file_icon') return new ArrayBuffer(0);
      },
    };
  });
  await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1423');
  await expect(page.locator('.title-right > button[title="偏好设置"]')).toHaveCount(0);
  await page.getByTitle('更多选项', { exact: true }).click();
  await page.getByRole('button', { name: '偏好设置', exact: true }).click();
  await expect(page.getByRole('heading', { name: '偏好设置' })).toBeVisible();
  await page.keyboard.press('Escape');
  const open = async (name) => {
    await page
      .locator('input[type=file]')
      .setInputFiles(fileURLToPath(new URL(`../test-results/fixtures/${name}`, import.meta.url)));
    await expect(page.locator('.file-title strong')).toHaveText(name);
  };
  const layout = async () => {
    await expect(
      page
        .locator('.titlebar .reading-tools, .titlebar .content-toolbar, .titlebar .floating-tools')
        .filter({ visible: true }),
    ).toHaveCount(0);
    await expect(
      page.locator(
        '.preview-container .reading-tools, .preview-container .content-toolbar, .preview-container .floating-tools, .preview-footer',
      ),
    ).toHaveCount(0);
    await expect(page.locator('.title-right > button[title="偏好设置"]')).toHaveCount(0);
    const bounds = await page.locator('.preview-container').boundingBox();
    expect(bounds.y).toBe(36);
    expect(bounds.height).toBe(page.viewportSize().height - 36);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByTitle('最小化', { exact: true })).toBeInViewport();
    await expect(page.getByTitle('最大化', { exact: true })).toBeInViewport();
  };
  for (const size of [
    { width: 1000, height: 760 },
    { width: 640, height: 480 },
  ]) {
    await page.setViewportSize(size);
    await open('阅读体验.md');
    await expect(page.locator('.document-paper')).toContainText('一次空格');
    await layout();
    await openPreviewMenu(page);
    await page.getByTitle('切换文档大纲', { exact: true }).click();
    await expect(page.locator('.reading-outline')).toHaveCount(0);
    await page.getByTitle('切换文档大纲', { exact: true }).click();
    await expect(page.locator('.preview-actions')).toHaveCount(0);
    await openPreviewMenu(page);
    await expect(page.locator('.dropdown select')).toHaveCount(3);
    const menuBounds = await page.locator('.dropdown').boundingBox();
    expect(menuBounds.x).toBeGreaterThanOrEqual(0);
    expect(menuBounds.x + menuBounds.width).toBeLessThanOrEqual(size.width);
    expect(menuBounds.y + menuBounds.height).toBeLessThanOrEqual(size.height);
    await page.getByLabel('阅读字号').selectOption('20');
    await expect(page.locator('.document-paper')).toHaveCSS('font-size', '20px');
    await page.getByLabel('阅读字体').selectOption('serif');
    await expect(page.locator('.document-paper')).toHaveCSS('font-family', /SimSun/);
    await page.screenshot({ path: `test-results/menu-markdown-${size.width}.png` });
    await page.getByLabel('关闭更多选项').click({ position: { x: 10, y: 100 } });
    await page.getByTitle('更多选项', { exact: true }).click();
    await expect(page.getByLabel('阅读字号')).toHaveValue('20');
    await expect(page.getByLabel('阅读字体')).toHaveValue('serif');
    await page.getByLabel('关闭更多选项').click({ position: { x: 10, y: 100 } });
    await page.screenshot({ path: `test-results/header-markdown-${size.width}.png` });
    await open('样式文档.docx');
    await expect(
      page.frameLocator('iframe[title="Word 原样预览"]').locator('section.docx'),
    ).toHaveCount(2);
    await layout();
    await page.getByTitle('更多选项', { exact: true }).click();
    await expect(page.locator('.dropdown select')).toHaveCount(1);
    await page.getByLabel('Word 缩放').selectOption('1.25');
    await expect(
      page.frameLocator('iframe[title="Word 原样预览"]').locator('section.docx').first(),
    ).toHaveCSS('zoom', '1.25');
    await closePreviewMenu(page);
    await openPreviewMenu(page);
    await expect(page.getByLabel('Word 缩放')).toHaveValue('1.25');
    await page.screenshot({ path: `test-results/menu-word-${size.width}.png` });
    await page.getByLabel('Word 缩放').selectOption('fit');
    await closePreviewMenu(page);
    await page.screenshot({ path: `test-results/header-word-${size.width}.png` });
    await open('editor.ts');
    await expect(page.locator('.code-line')).not.toHaveCount(0);
    await openPreviewMenu(page);
    await page.getByLabel('查找文本').fill('const');
    await expect(page.locator('.code-line.matched')).not.toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('.dropdown')).toHaveCount(0);
    await openPreviewMenu(page);
    await expect(page.getByLabel('查找文本')).toHaveValue('const');
    await closePreviewMenu(page);
    await layout();
    await open('smoke.pdf');
    await expect(page.locator('.pdf-scroll canvas')).toBeVisible();
    await expect
      .poll(() => page.locator('.pdf-scroll canvas').evaluate((canvas) => canvas.height))
      .toBeGreaterThan(400);
    await layout();
    await openPreviewMenu(page);
    await expect(page.locator('.dropdown .floating-tools')).toBeVisible();
    await page.getByTitle('搜索 PDF', { exact: true }).click();
    await expect(page.locator('.pdf-sidebar')).toBeVisible();
    await page.getByTitle('放大', { exact: true }).click();
    await expect(page.locator('.dropdown .floating-tools')).toContainText('125%');
    await page.screenshot({ path: `test-results/menu-pdf-${size.width}.png` });
    await closePreviewMenu(page);
    await page.screenshot({ path: `test-results/header-pdf-${size.width}.png` });
  }
  await page
    .locator('input[type=file]')
    .setInputFiles(
      ['license.dat', 'editor.ts'].map((name) =>
        fileURLToPath(new URL(`../test-results/fixtures/${name}`, import.meta.url)),
      ),
    );
  await expect(page.locator('.file-navigation')).toContainText('1/2');
  await page.getByTitle('下一个文件 · →', { exact: true }).click();
  await expect(page.locator('.file-title strong')).toHaveText('editor.ts');
  await expect(page.locator('.file-navigation')).toContainText('2/2');
  await page.getByTitle('上一个文件 · ←', { exact: true }).click();
  await expect(page.locator('.file-title strong')).toHaveText('license.dat');
  await expect(page.locator('.code-scroll')).toContainText('授权状态');
  await page.locator('input[type=file]').setInputFiles({
    name: 'header.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="140" height="100"><rect width="140" height="100" fill="#168ed0"/></svg>',
    ),
  });
  await expect
    .poll(() => page.locator('.image-preview img').evaluate((image) => image.naturalWidth))
    .toBe(140);
  await layout();
  await openPreviewMenu(page);
  await page.getByTitle('放大', { exact: true }).click();
  await expect(page.getByTitle('重置视图', { exact: true })).toHaveText('125%');
  await page.getByTitle('放大', { exact: true }).dblclick();
  await expect(page.getByTitle('重置视图', { exact: true })).toHaveText('175%');
  await page.getByTitle('重置视图', { exact: true }).click();
  await page.screenshot({ path: 'test-results/menu-image-640.png' });
  await closePreviewMenu(page);
  await page.screenshot({ path: 'test-results/header-image-640.png' });
  await page.getByTitle('更多选项', { exact: true }).click();
  await expect(page.locator('.dropdown select')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '默认应用打开', exact: false })).toBeVisible();
  await page.getByRole('button', { name: '偏好设置', exact: true }).click();
  await expect(page.getByRole('heading', { name: '偏好设置' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByTitle('最大化', { exact: true }).click();
  await expect(page.getByTitle('恢复窗口', { exact: true })).toBeVisible();
  await page.getByTitle('恢复窗口', { exact: true }).click();
  await expect(page.getByTitle('最大化', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    'Merged header passed: 36px single header, full-height content, Markdown/Word controls, code search, PDF controls, preferences via menu, native buttons, 1000/640px layouts. Native bridge simulated; real Windows verification is separate.',
  );
} finally {
  await browser.close();
}
