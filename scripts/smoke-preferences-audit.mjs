import { chromium, expect } from '@playwright/test';
import { zipSync, strToU8 } from 'fflate';
import { openPreviewMenu } from './preview-menu.mjs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    let id = 0;
    const callbacks = new Map();
    const contents = new TextEncoder().encode('Preference audit text\n');
    const paths = ['C:\\Preview tests\\first.txt', 'C:\\Preview tests\\second.txt'];
    const metadata = (path) => ({
      id: path,
      name: path.split('\\').at(-1),
      path,
      size: contents.length,
      modified: 1700000000000,
      mime: 'text/plain',
    });
    window.nativeCalls = [];
    window.nativeListeners = [];
    window.mockFocused = true;
    window.mockEnabled = true;
    window.mockAutostart = false;
    window.copiedPaths = [];
    window.isTauri = true;
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (text) => {
          window.copiedPaths.push(text);
        },
      },
      configurable: true,
    });
    window.emitNative = (event, payload) => {
      for (const listener of [...window.nativeListeners].filter(
        (listener) => listener.event === event,
      ))
        callbacks.get(listener.handler)?.({ event, id: listener.id, payload });
    };
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
        window.nativeCalls.push({ command, args });
        if (command === 'plugin:event|listen') {
          const listener = { ...args, id: ++id };
          window.nativeListeners.push(listener);
          return listener.id;
        }
        if (command === 'plugin:event|unlisten') {
          window.nativeListeners = window.nativeListeners.filter(
            (listener) => listener.id !== args.eventId,
          );
          return;
        }
        if (command === 'plugin:window|is_focused') return window.mockFocused;
        if (command === 'plugin:window|is_maximized') return false;
        if (command === 'agent_status')
          return {
            platform: 'windows',
            supported: true,
            enabled: window.mockEnabled,
            running: true,
          };
        if (command === 'set_agent_enabled') {
          window.mockEnabled = args.enabled;
          return;
        }
        if (command === 'autostart_enabled') return window.mockAutostart;
        if (command === 'set_autostart') return (window.mockAutostart = args.enabled);
        if (command === 'initial_paths') return { paths: [paths[0]], text: false };
        if (command === 'inspect_file') return metadata(args.path);
        if (command === 'list_siblings') return paths.map(metadata);
        if (command === 'read_prefix') return contents.slice(0, args.limit).buffer;
        if (command === 'read_range')
          return contents.slice(args.offset, args.offset + args.limit).buffer;
        if (command === 'plugin:dialog|open')
          return new Promise((resolve) => {
            window.resolvePicker = resolve;
          });
      },
    };
  });
  await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1423');
  const title = page.locator('.file-title strong');
  await expect(title).toHaveText('first.txt');
  await expect(page.locator('.code-scroll')).toContainText('Preference audit text');
  const settings = async () => {
    await openPreviewMenu(page);
    await page.getByRole('button', { name: '偏好设置', exact: true }).click();
    await expect(page.locator('.settings-dialog')).toBeVisible();
  };
  const closeSettings = () => page.getByRole('button', { name: '关闭设置', exact: true }).click();
  const calls = (command) =>
    page.evaluate(
      (command) => window.nativeCalls.filter((call) => call.command === command),
      command,
    );
  await settings();
  const panelColor = () =>
    page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--panel').trim(),
    );
  await page.getByRole('button', { name: '浅色', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const light = await panelColor();
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const dark = await panelColor();
  expect(dark).not.toBe(light);
  await page.getByRole('button', { name: '跟随系统', exact: true }).click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(panelColor).toBe(dark);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(panelColor).toBe(light);
  const enabled = page.getByRole('switch', { name: '资源管理器 快捷键预览', exact: true });
  await enabled.click();
  await expect
    .poll(async () => (await calls('set_agent_enabled')).at(-1)?.args.enabled)
    .toBe(false);
  await expect(page.locator('.settings-dialog')).toContainText('快捷键预览已关闭');
  await enabled.click();
  await expect.poll(async () => (await calls('set_agent_enabled')).at(-1)?.args.enabled).toBe(true);
  await page.getByRole('switch', { name: '失去焦点时关闭', exact: true }).click();
  await closeSettings();
  await page.locator('.code-scroll').click();
  await page.keyboard.press('Control+ArrowRight');
  await expect(title).toHaveText('first.txt');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(title).toHaveText('first.txt');
  await page.keyboard.press('ArrowRight');
  await expect(title).toHaveText('second.txt');
  await page.keyboard.press('ArrowLeft');
  await expect(title).toHaveText('first.txt');
  await page.keyboard.press('Alt+Enter');
  await page.keyboard.press('Control+Enter');
  expect((await calls('open_default')).length).toBe(0);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await calls('open_default')).length).toBe(1);
  expect((await calls('open_default'))[0].args.path).toBe('C:\\Preview tests\\first.txt');
  for (const key of ['Control+Shift+c', 'Meta+Shift+c']) {
    await page.keyboard.press(key);
    await expect
      .poll(() => page.evaluate(() => window.copiedPaths.at(-1)))
      .toBe('C:\\Preview tests\\first.txt');
  }
  await openPreviewMenu(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.dropdown')).toHaveCount(0);
  await expect(title).toHaveText('first.txt');
  await settings();
  await page.keyboard.press('Escape');
  await expect(page.locator('.settings-dialog')).toHaveCount(0);
  await expect(title).toHaveText('first.txt');
  await page.locator('.code-scroll').click();
  await page.keyboard.press('Control+o');
  await expect.poll(() => page.evaluate(() => typeof window.resolvePicker)).toBe('function');
  await page.keyboard.press('Control+o');
  expect((await calls('plugin:dialog|open')).length).toBe(1);
  await page.evaluate(() => {
    window.mockFocused = false;
    window.emitNative('tauri://blur', null);
  });
  await page.waitForTimeout(100);
  await expect(title).toHaveText('first.txt');
  expect((await calls('hide_preview')).length).toBe(0);
  await page.evaluate(() => {
    window.mockFocused = true;
    window.resolvePicker(null);
  });
  await page.waitForTimeout(100);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.nativeListeners.some((listener) => listener.event === 'tauri://blur'),
      ),
    )
    .toBe(true);
  await page.evaluate(() => {
    window.mockFocused = false;
    window.emitNative('tauri://blur', null);
  });
  await expect(page.locator('.welcome')).toBeVisible();
  await expect.poll(async () => (await calls('hide_preview')).length).toBe(1);
  await page.evaluate(() => {
    window.mockFocused = true;
  });
  await page.locator('input[type=file]').setInputFiles({
    name: 'audit.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Audit heading\n\nBody'),
  });
  await expect(page.locator('.prose')).toContainText('Audit heading');
  await page.locator('.reading-outline nav button').first().focus();
  await page.keyboard.press('Shift+Space');
  await expect(page.locator('.code-scroll')).toContainText('# Audit heading');
  await page.keyboard.press('Shift+Space');
  await expect(page.locator('.prose')).toContainText('Audit heading');
  await page.locator('input[type=file]').setInputFiles({
    name: 'audit.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(zipSync({ 'inside.txt': strToU8('Archive body') })),
  });
  await page.locator('.archive-row').filter({ hasText: 'inside.txt' }).dblclick();
  await expect(title).toHaveText('inside.txt');
  await expect(page.locator('.preview-layer:visible .code-scroll')).toContainText('Archive body');
  await page.locator('.preview-layer:visible .code-scroll').click();
  await page.keyboard.press('Control+Shift+c');
  await expect.poll(() => page.evaluate(() => window.copiedPaths.at(-1))).toBe('inside.txt');
  await expect(page.locator('.toast')).toContainText('当前预览没有本地路径');
  await page.keyboard.press('Enter');
  await expect(page.locator('.toast')).toContainText('保存或解压到磁盘');
  expect((await calls('open_default')).length).toBe(1);
  await page.evaluate(() => window.emitNative('preview-closed', null));
  await expect(page.locator('.welcome')).toBeVisible();
  await expect(page.locator('.preview-layer')).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log(
    'Preferences audit PASS: themes/system changes, agent toggle, exact navigation/open modifiers, copy path, Escape priorities, picker blur protection, Shift+Space on buttons, native archive close cleanup.',
  );
} finally {
  await browser.close();
}
