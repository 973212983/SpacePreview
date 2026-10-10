import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { zipSync, strToU8 } from 'fflate';

const png = [
  ...(await readFile(new URL('../test-results/system-shortcut-icon.png', import.meta.url))),
];
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
  await page.addInitScript((png) => {
    let id = 0;
    const callbacks = new Map();
    window.isTauri = true;
    window.iconCalls = [];
    window.iconListeners = {};
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
    window.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
      transformCallback(callback) {
        callbacks.set(++id, callback);
        return id;
      },
      unregisterCallback(callback) {
        callbacks.delete(callback);
      },
      async invoke(command, args) {
        if (command === 'agent_status') return { supported: true, enabled: true, running: true };
        if (command === 'initial_paths') return { paths: ['C:\\icons\\软件.lnk'], text: false };
        if (command === 'plugin:event|listen') {
          window.iconListeners[args.event] = callbacks.get(args.handler);
          return ++id;
        }
        if (command === 'plugin:window|is_maximized') return false;
        if (command === 'inspect_file')
          return {
            id: args.path,
            path: args.path,
            name: args.path.split('\\').at(-1),
            size: 128,
            modified: 0,
            mime: 'application/octet-stream',
          };
        if (command === 'list_siblings') return [];
        if (command === 'read_prefix') return Uint8Array.from([77, 90, 0, 0, 1, 2, 3, 0]).buffer;
        if (command === 'file_icon') {
          window.iconCalls.push(args);
          if (args.name === 'slow.exe')
            return new Promise((resolve) => {
              window.resolveSlowIcon = () => resolve(Uint8Array.from(png).buffer);
            });
          if (args.name === 'failed.exe') throw new Error('Icon unavailable');
          if (args.name === 'broken.exe') return Uint8Array.from([1, 2, 3]).buffer;
          return Uint8Array.from(png).buffer;
        }
      },
    };
  }, png);
  await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1423');
  const icon = page.locator('.binary-preview .file-type-icon');
  await expect(icon).toHaveClass(/system-file-icon/);
  await expect(page.locator('.binary-type-badge')).toHaveText('快捷方式');
  expect(await icon.evaluate((img) => img.complete && img.naturalWidth === 64)).toBe(true);
  expect(await page.evaluate(() => window.iconCalls[0].path)).toBe('C:\\icons\\软件.lnk');
  await page.screenshot({ path: 'test-results/system-shortcut-preview.png' });

  const select = async (name) => {
    await page.evaluate(
      (name) =>
        window.iconListeners['preview-files']({
          payload: { paths: [`C:\\icons\\${name}`], text: false },
        }),
      name,
    );
    await expect(page.locator('.file-title strong')).toHaveText(name);
  };
  await select('slow.exe');
  await expect.poll(() => page.evaluate(() => typeof window.resolveSlowIcon)).toBe('function');
  await expect(icon).not.toHaveClass(/system-file-icon/);
  await select('failed.exe');
  await expect(icon).not.toHaveClass(/system-file-icon/);
  await page.evaluate(() => window.resolveSlowIcon());
  await expect(icon).not.toHaveClass(/system-file-icon/);
  await select('broken.exe');
  await expect(icon).not.toHaveClass(/system-file-icon/);
  await expect(page.locator('.binary-preview')).toContainText('broken.exe');

  const archive = Buffer.from(
    zipSync({
      'notes/a.txt': strToU8('A'),
      'notes/b.txt': strToU8('B'),
      'app.exe': new Uint8Array([77, 90, 0]),
    }),
  );
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'icons.zip', mimeType: 'application/zip', buffer: archive });
  const list = page.locator('.archive-preview:visible .archive-list');
  await expect(list.locator('img.system-file-icon')).toHaveCount(2);
  await list.locator('.archive-row').filter({ hasText: 'notes' }).dblclick();
  await expect(list.locator('img.system-file-icon')).toHaveCount(2);
  const calls = await page.evaluate(() => window.iconCalls);
  expect(calls.filter((args) => args.path === null && args.name.endsWith('.txt'))).toHaveLength(1);
  expect(calls.some((args) => args.path === null && args.folder)).toBe(true);
  expect(calls.some((args) => args.path === null && args.name === 'app.exe')).toBe(true);
  expect(errors).toEqual([]);
  console.log(
    'System icon UI passed: native path, PNG/shortcut label, stale responses, failure/image fallback, archive associations/cache, desktop CSP.',
  );
} finally {
  await browser.close();
}
