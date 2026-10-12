import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { containerFixtures } from './container-fixtures.mjs';
import { openPreviewMenu, closePreviewMenu } from './preview-menu.mjs';

const fixtures = await containerFixtures();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errors = [],
    remote = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/example\.(?:invalid|test)/.test(request.url())) remote.push(request.url());
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
      .setInputFiles({
        name,
        mimeType: 'application/octet-stream',
        buffer: Buffer.from(fixtures[name]),
      });
    await expect(page.locator('.file-title strong')).toHaveText(name);
  };
  for (const name of Object.keys(fixtures).filter((name) =>
    /\.(asar|crx|cfb|eif|msi|msp|pak|aab|appx|appxbundle|msix|msixbundle|hap|wgt|wgtu|qlplugin|ar|cpio|xar)$/.test(
      name,
    ),
  )) {
    await open(name);
    await expect(page.locator('.archive-list')).toBeVisible({ timeout: 30000 });
    const directory = page
      .locator('.archive-row')
      .filter({ has: page.getByText('目录', { exact: true }) });
    if (await directory.count()) await directory.dblclick();
    const row = page.locator('.archive-row').filter({ hasText: /hello.txt|resource-100.dat/ });
    await row.dblclick();
    await expect(page.locator('.code-scroll')).toContainText('容器里面的中文内容');
    await page.locator('.archive-back-button').click();
    await expect(page.locator('.archive-row.selected')).toContainText(/hello.txt|resource-100.dat/);
    const picture = page.locator('.archive-row').filter({ hasText: 'picture.png' });
    if (await picture.count()) {
      await picture.dblclick();
      await expect(page.locator('.preview-image')).toBeVisible({ timeout: 30000 });
    }
    console.log('container', name, 'PASS');
  }
  for (const ext of [
    'kra',
    'sketch',
    'xd',
    'xmind',
    'fig',
    'cdr',
    'pix',
    'pip',
    'pdn',
    'icns',
    'ani',
    'svgz',
  ]) {
    await open(`sample.${ext}`);
    await expect(page.locator('.preview-image')).toBeVisible({ timeout: 30000 });
    expect(
      await page.locator('.preview-image').evaluate((image) => image.naturalWidth),
    ).toBeGreaterThan(0);
    if (ext === 'ani') {
      await openPreviewMenu(page);
      await page.getByRole('button', { name: '下一页', exact: true }).click();
      await closePreviewMenu(page);
      await expect(page.locator('.preview-image')).toBeVisible({ timeout: 30000 });
      await openPreviewMenu(page);
      await expect(page.locator('.dropdown')).toContainText('第 2 / 2');
      await closePreviewMenu(page);
    }
    console.log('thumbnail/icon', ext, 'PASS');
  }
  await open('sample.ttc');
  await expect(page.locator('.font-paper h1')).toContainText('Liberation Sans');
  await openPreviewMenu(page);
  await page.getByLabel('集合字体').selectOption('1');
  await closePreviewMenu(page);
  await expect(page.locator('.font-paper h1')).toContainText('Bold');
  expect(
    await page
      .locator('.font-paper textarea')
      .evaluate((node) => document.fonts.check('32px ' + getComputedStyle(node).fontFamily)),
  ).toBe(true);
  console.log('TTC switch PASS');
  await open('sample.mhtml');
  const frame = page.frameLocator('iframe[title="HTML 网页预览"]');
  await expect(frame.locator('h1')).toHaveText('完整网页存档');
  await expect(frame.locator('h1')).toHaveCSS('color', 'rgb(22, 142, 208)');
  await expect(frame.locator('img').first()).toHaveAttribute('src', /^data:image\/png;base64,/);
  expect(
    await frame
      .locator('img')
      .first()
      .evaluate((image) => image.naturalWidth),
  ).toBeGreaterThan(0);
  expect(await frame.locator('body').evaluate(() => window.untrustedRan)).toBeUndefined();
  console.log('MHTML resources PASS');
  await page.screenshot({ path: 'test-results/formats-mhtml.png' });
  expect(remote).toEqual([]);
  expect(errors).toEqual([]);
} finally {
  await browser.close();
}
