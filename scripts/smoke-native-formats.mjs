import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';

const executable = resolve('src-tauri/target/release/space-preview.exe');
const port = 1431;
const child = spawn(executable, [], {
  windowsHide: true,
  stdio: 'ignore',
  env: {
    ...process.env,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1`,
  },
});
let browser;
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Native app exited: ${child.exitCode}`);
    try {
      await fetch(`http://127.0.0.1:${port}/json/version`).then((response) => {
        if (!response.ok) throw new Error('not ready');
      });
      break;
    } catch {
      if (attempt === 99) throw new Error('WebView2 debug endpoint did not start.');
      await delay(100);
    }
  }
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context = browser.contexts()[0];
  let page;
  for (let attempt = 0; attempt < 100; attempt++) {
    page = context.pages().find((page) => /^https?:\/\/tauri\.localhost\//.test(page.url()));
    if (page) break;
    await delay(100);
  }
  if (!page) throw new Error('The owned native app page was not found.');
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await expect(page.locator('input[type=file]')).toBeAttached();
  for (const name of [
    'sample.heic',
    'archive.7z',
    'hello.txt.bz2',
    'hello.txt.xz',
    'sample.step',
    'sample.sqlite',
    'sample.msg',
  ]) {
    await page.locator('input[type=file]').setInputFiles(resolve('test-results/fixtures', name));
    await expect(page.locator('.file-title strong')).toHaveText(name);
    const target = name.endsWith('.heic')
      ? '.preview-image'
      : /\.(7z|bz2|xz)$/.test(name)
        ? '.archive-list'
        : name.endsWith('.step')
          ? '.model-preview canvas'
          : name.endsWith('.sqlite')
            ? '.database-preview'
            : '.mail-header';
    await expect(page.locator(target)).toBeVisible({ timeout: 120000 });
    if (name.endsWith('.heic'))
      expect(
        await page.locator('.preview-image').evaluate((image) => image.naturalWidth),
      ).toBeGreaterThan(0);
    if (name.endsWith('.7z')) await expect(page.locator('.archive-row').first()).toBeVisible();
    if (/\.(bz2|xz)$/.test(name)) {
      await page.locator('.archive-row').filter({ hasText: 'hello.txt' }).dblclick();
      await expect(page.locator('.code-scroll')).toContainText('独立压缩流完整中文内容');
    }
    if (name.endsWith('.step'))
      await expect(page.locator('.model-loading')).toHaveCount(0, { timeout: 120000 });
    if (name.endsWith('.sqlite')) {
      await page.getByRole('button', { name: /^中文表/ }).click();
      await expect(page.locator('.database-grid')).toContainText('记录 1', { timeout: 30000 });
    }
    if (name.endsWith('.msg')) await expect(page.locator('.mail-text')).toContainText('你好');
    await expect(page.locator('[role=alert]')).toHaveCount(0);
    console.log('native WebView2', name, 'PASS');
  }
  await page.screenshot({ path: 'test-results/formats-native.png' });
  expect(errors).toEqual([]);
} finally {
  if (browser) await browser.close();
  if (child.exitCode === null) child.kill();
}
