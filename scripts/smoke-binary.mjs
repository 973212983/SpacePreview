import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { openPreviewMenu, closePreviewMenu } from './preview-menu.mjs';

const endpoint = process.env.BINARY_CDP;
const browser = endpoint
  ? await chromium.connectOverCDP(endpoint)
  : await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = endpoint
    ? browser
        .contexts()[0]
        .pages()
        .find((page) => /tauri\.localhost/.test(page.url()))
    : await browser.newPage({ viewport: { width: 1000, height: 760 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  if (!endpoint) await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1423');
  await page.evaluate(() => {
    window.binaryReads = [];
    const slice = Blob.prototype.slice;
    Blob.prototype.slice = function (start, end, type) {
      window.binaryReads.push({ start, end });
      return slice.call(this, start, end, type);
    };
  });
  const binary = page.locator('.preview-layer:visible .binary-preview');
  const forceText = async () => {
    await openPreviewMenu(page);
    await page.getByRole('button', { name: '纯文本预览', exact: true }).click();
    await expect(binary).toContainText('检测到二进制内容', { timeout: 5000 });
    await expect(binary.locator('.hex-bytes').first()).toContainText('4D5A');
    await expect(page.locator('.preview-layer:visible .spinner')).toHaveCount(0);
  };
  if (endpoint) {
    // The owned desktop test starts with a real filesystem path, not a Blob.
    await expect(page.locator('.file-title strong')).toHaveText('shell32.dll');
    await expect(binary).toContainText('Windows 可执行文件');
    await forceText();
    console.log('Native path-backed DLL automatic and text fallback PASS.');
  }
  const dll = await readFile('C:/Windows/System32/shell32.dll');
  for (const name of [
    'GameDll.dll',
    'GameDll.DLL',
    'renamed.ddl',
    'renamed.txt',
    'library.exe',
    'library.dat',
  ]) {
    await closePreviewMenu(page);
    await page.evaluate(() => {
      window.binaryReads = [];
    });
    await page
      .locator('input[type=file]')
      .setInputFiles({ name, mimeType: 'application/octet-stream', buffer: dll });
    await expect(binary).toContainText(name, { timeout: 5000 });
    await forceText();
    if (name === 'GameDll.dll')
      await page.screenshot({ path: 'test-results/binary-dll-fixed.png' });
    expect(await page.evaluate(() => window.binaryReads.every((read) => read.end <= 16384))).toBe(
      true,
    );
    await openPreviewMenu(page);
    await page.getByRole('button', { name: '自动预览', exact: true }).click();
    await expect(binary).toBeVisible();
    console.log(name, 'PASS: binary view, text fallback, bounded reads, mode switching');
  }
  await page.locator('input[type=file]').setInputFiles({
    name: 'schema.ddl',
    mimeType: 'text/plain',
    buffer: Buffer.from('CREATE TABLE users (id INTEGER PRIMARY KEY);\n-- 中文建表脚本'),
  });
  await expect(page.locator('.code-scroll')).toContainText('中文建表脚本');
  await expect(page.locator('.hljs-keyword').first()).toContainText('CREATE');
  await expect(binary).toHaveCount(0);
  // Content sniffing must still recognize extensionless/unknown text documents.
  await page.locator('input[type=file]').setInputFiles({
    name: 'license.dat',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('授权有效\nLicense information'),
  });
  await expect(page.locator('.code-scroll')).toContainText('授权有效');
  await expect(binary).toHaveCount(0);
  await page.locator('input[type=file]').setInputFiles({
    name: 'accented.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('café '.repeat(4000), 'latin1'),
  });
  await expect(page.locator('.code-scroll')).toBeVisible();
  await openPreviewMenu(page);
  await page.getByLabel('文本编码').selectOption('windows-1252');
  await closePreviewMenu(page);
  await expect(page.locator('.code-scroll')).toContainText('café');
  await expect(binary).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/binary-text-regression.png' });
  console.log(
    'Binary regression PASS: DLL does not enter full text parsing; real DDL and license text remain readable.',
  );
} finally {
  await browser.close();
}
