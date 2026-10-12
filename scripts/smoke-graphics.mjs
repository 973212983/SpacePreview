import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import './graphics-fixtures.mjs';
import { openPreviewMenu, closePreviewMenu } from './preview-menu.mjs';
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } }),
    errors = [],
    remote = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (r.url().includes('example.invalid')) remote.push(r.url());
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
  await open('网页样式.html');
  await expect(page.locator('.code-scroll')).toContainText('<!doctype html>');
  await expect(page.locator('.hljs-tag').first()).toBeVisible();
  await expect(page.locator('iframe[title="HTML 网页预览"]')).toHaveCount(0);
  await expect(page.locator('.titlebar .preview-menu-option')).toHaveCount(0);
  await openPreviewMenu(page);
  await expect(page.getByLabel('HTML 视图')).toHaveValue('source');
  await page.getByLabel('HTML 视图').selectOption('web');
  await closePreviewMenu(page);
  const html = page.frameLocator('iframe[title="HTML 网页预览"]');
  await expect(html.locator('h1')).toHaveCSS('color', 'rgb(120, 89, 189)');
  await expect(html.locator('.grid')).toHaveCSS('display', 'grid');
  expect(
    await html.locator('html').evaluate((el) => getComputedStyle(el, '::-webkit-scrollbar').width),
  ).toBe('5px');
  await expect(html.locator('script,form,img[src]')).toHaveCount(0);
  expect(
    await page
      .frames()
      .find((f) => f.url() === 'about:srcdoc')
      .evaluate(() => window.untrustedRan),
  ).toBeUndefined();
  await page.screenshot({ path: 'test-results/graphics-html.png' });
  await html.locator('h1').click();
  await page.keyboard.press('Space');
  await expect(page.locator('.welcome')).toBeVisible();
  await open('网页样式.html');
  await expect(page.locator('.code-scroll')).toContainText('<!doctype html>');
  await openPreviewMenu(page);
  await page.getByLabel('HTML 视图').selectOption('web');
  await page.getByRole('button', { name: '阅读模式', exact: true }).click();
  await expect(page.locator('.reading-outline nav button')).toHaveCount(4);
  await page.getByLabel('HTML 视图').selectOption('source');
  await expect(page.locator('.code-scroll')).toContainText('<!doctype html>');
  await expect(page.getByLabel('HTML 视图')).toHaveValue('source');
  await page.getByLabel('HTML 视图').selectOption('web');
  await expect(html.locator('h1')).toHaveCSS('color', 'rgb(120, 89, 189)');
  await closePreviewMenu(page);
  for (const name of ['page.htm', 'page.xhtml']) {
    await page.locator('input[type=file]').setInputFiles({
      name,
      mimeType: 'text/html',
      buffer: Buffer.concat([
        Buffer.from('<meta charset="windows-1252"><h1>caf'),
        Buffer.from([0xe9]),
        Buffer.from('</h1>'),
      ]),
    });
    await expect(page.locator('.code-scroll')).toContainText('<h1>café</h1>');
    await openPreviewMenu(page);
    await expect(page.getByLabel('HTML 视图')).toHaveValue('source');
    await page.getByLabel('HTML 视图').selectOption('web');
    await expect(html.locator('h1')).toHaveText('café');
    await closePreviewMenu(page);
  }
  await open('Dockerfile.dev');
  await expect(page.locator('.hljs-keyword').first()).toHaveText('FROM');
  await open('CMakeLists.txt');
  await expect(page.locator('.source-code')).toBeVisible();
  await expect(page.locator('.hljs-keyword').first()).toContainText('cmake_minimum_required');
  await open('代码.psm1');
  await expect(page.locator('.hljs-keyword').first()).toHaveText('function');
  await page.screenshot({ path: 'test-results/graphics-code.png' });
  await open('机械图纸.dxf');
  const svg = page.getByLabel('DXF 图纸预览');
  await expect(svg.locator('polyline')).toHaveCount(5);
  await expect(svg.locator('text')).toContainText('DXF 图纸预览');
  await page.getByLabel('孔位', { exact: true }).uncheck();
  await expect(svg.locator('polyline')).toHaveCount(3);
  await page.getByLabel('孔位', { exact: true }).check();
  const before = await svg.getAttribute('viewBox');
  await openPreviewMenu(page);
  await page.getByTitle('放大图纸', { exact: true }).click();
  expect(await svg.getAttribute('viewBox')).not.toBe(before);
  await page.getByTitle('适应图纸', { exact: true }).click();
  await expect(svg).toHaveAttribute('viewBox', before);
  await closePreviewMenu(page);
  await svg.hover();
  await page.mouse.wheel(0, -100);
  await expect(svg).not.toHaveAttribute('viewBox', before);
  const box = await svg.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30);
  await page.mouse.up();
  await openPreviewMenu(page);
  await page.getByTitle('适应图纸', { exact: true }).click();
  await closePreviewMenu(page);
  await page.screenshot({ path: 'test-results/graphics-dxf.png' });
  for (const name of ['四面体.stl', '四面体.obj']) {
    await open(name);
    await openPreviewMenu(page);
    await expect(page.locator('.dropdown .content-toolbar')).toContainText('4 三角面', {
      timeout: 20000,
    });
    await expect(page.locator('.model-canvas canvas')).toBeVisible();
    await closePreviewMenu(page);
    const canvas = page.locator('.model-canvas canvas');
    const beforeRotation = await canvas.screenshot();
    const bounds = await canvas.boundingBox();
    await page.mouse.move(bounds.x + bounds.width * 0.45, bounds.y + bounds.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.65, bounds.y + bounds.height * 0.65, {
      steps: 8,
    });
    await page.mouse.up();
    expect((await canvas.screenshot()).equals(beforeRotation)).toBe(false);
    await openPreviewMenu(page);
    await page.getByRole('button', { name: '适应模型', exact: true }).click();
    await closePreviewMenu(page);
    await page.screenshot({
      path: `test-results/graphics-${name.endsWith('stl') ? 'stl' : 'obj'}.png`,
    });
  }
  await open('渐变图像.tiff');
  await expect(page.locator('.preview-image')).toBeVisible();
  await openPreviewMenu(page);
  await expect(page.locator('.dropdown .content-toolbar')).toContainText('第 1 / 1 页');
  await closePreviewMenu(page);
  await page.screenshot({ path: 'test-results/graphics-tiff.png' });
  await page.setViewportSize({ width: 640, height: 480 });
  await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
  await open('机械图纸.dxf');
  await expect(svg).toBeVisible();
  await page.screenshot({ path: 'test-results/graphics-small-dark.png' });
  expect(remote).toEqual([]);
  expect(errors).toEqual([]);
  console.log(
    'Graphics UI passed: styled/sandboxed HTML, iframe Space close, reading/source, code aliases/highlighting, DXF layers/zoom/pan, STL/OBJ WebGL, TIFF pixels, small dark window, native CSP.',
  );
} finally {
  await browser.close();
}
