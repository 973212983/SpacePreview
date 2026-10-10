import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Exercise the real production UI with a simulated macOS native bridge.
// This does not replace Finder/TCC/WebKit verification on a Mac.
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) console.log(message.type(), message.text());
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
  await page.route('**/pdf.worker-*.js', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: `Promise.withResolvers = undefined;\n${await response.text()}`,
    });
  });
  await page.addInitScript(() => {
    Promise.withResolvers = undefined;
    let id = 0;
    window.isTauri = true;
    window.macCalls = [];
    window.macAgent = {
      platform: 'macos',
      supported: true,
      running: false,
      enabled: true,
      accessibility: false,
      automation: false,
      keyboard: false,
    };
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
    window.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
      transformCallback() {
        return ++id;
      },
      unregisterCallback() {},
      async invoke(command, args) {
        window.macCalls.push({ command, args });
        if (command === 'agent_status') return { ...window.macAgent };
        if (command === 'set_agent_enabled') window.macAgent.enabled = args.enabled;
        if (command === 'initial_paths') return { paths: [], text: false };
        if (command === 'plugin:event|listen') return ++id;
        if (command === 'plugin:window|is_maximized') return false;
      },
    };
  });
  await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1423');
  await expect(page.locator('.platform-chip')).toHaveText('Finder 预览待授权');
  await expect(page.locator('.hero-actions button')).toContainText('⌘ O');
  await page.getByTitle('更多选项', { exact: true }).click();
  await page.getByRole('button', { name: '偏好设置', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Finder 空格预览' })).toBeVisible();
  await expect(page.locator('.mac-permissions')).toContainText('辅助功能');
  await page.setViewportSize({ width: 640, height: 480 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.setViewportSize({ width: 1000, height: 760 });
  await page.screenshot({ path: 'test-results/macos-permissions.png' });
  expect(
    await page.evaluate(
      () => window.macCalls.filter((call) => call.command === 'request_agent_permissions').length,
    ),
  ).toBe(0);
  await page.getByRole('button', { name: '授权 Finder 预览', exact: true }).click();
  expect(
    await page.evaluate(
      () => window.macCalls.filter((call) => call.command === 'request_agent_permissions').length,
    ),
  ).toBe(1);
  // Polling refreshes permission state without prompting again.
  await page.evaluate(() => {
    window.macAgent.accessibility = true;
  });
  await expect(page.getByText('请允许瞬览读取 Finder 中选中的文件')).toBeVisible({ timeout: 7000 });
  await page.evaluate(() => {
    Object.assign(window.macAgent, { automation: true, keyboard: true, running: true });
  });
  await expect(page.locator('.mac-permissions')).toHaveCount(0, { timeout: 7000 });
  await expect(page.getByText('原生监听已运行 · 支持 Finder 与桌面')).toBeVisible();
  await page.getByRole('switch', { name: 'Finder 空格预览' }).click();
  await expect(page.getByRole('switch', { name: 'Finder 空格预览' })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  expect(
    await page.evaluate(
      () => window.macCalls.filter((call) => call.command === 'request_agent_permissions').length,
    ),
  ).toBe(1);
  const calls = await page.evaluate(() => window.macCalls);
  expect(calls.findIndex((call) => call.command === 'initial_paths')).toBeGreaterThan(
    calls.findIndex(
      (call) => call.command === 'plugin:event|listen' && call.args.event === 'preview-files',
    ),
  );
  await page.setViewportSize({ width: 640, height: 480 });
  await page.getByRole('button', { name: '深色', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/macos-settings.png' });
  await page.getByRole('button', { name: '关闭设置', exact: true }).click();
  await page
    .locator('input[type=file]')
    .setInputFiles(fileURLToPath(new URL('../test-results/fixtures/smoke.pdf', import.meta.url)));
  await expect(page.locator('.pdf-toolbar')).toContainText('PDF · 1 页');
  await expect
    .poll(() =>
      page.locator('.pdf-preview canvas').evaluate((canvas) => {
        if (!canvas.width || !canvas.height) return false;
        const bytes = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        return bytes.some((value, i) => i % 4 !== 3 && value < 150);
      }),
    )
    .toBe(true);
  await page.screenshot({ path: 'test-results/macos-pdf-compat.png' });
  await page.evaluate(() => {
    window.Worker = class {
      constructor() {
        throw new Error('Worker unavailable in compatibility test');
      }
    };
  });
  await page.locator('input[type=file]').setInputFiles({
    name: 'fallback.pdf',
    mimeType: 'application/pdf',
    buffer: await readFile(new URL('../test-results/fixtures/smoke.pdf', import.meta.url)),
  });
  await expect(page.locator('.file-title strong')).toHaveText('fallback.pdf');
  await expect(page.locator('.pdf-toolbar')).toContainText('PDF · 1 页');
  await expect
    .poll(() =>
      page.locator('.pdf-preview canvas').evaluate((canvas) => {
        if (!canvas.width || !canvas.height) return false;
        return canvas
          .getContext('2d')
          .getImageData(0, 0, canvas.width, canvas.height)
          .data.some((value, i) => i % 4 !== 3 && value < 150);
      }),
    )
    .toBe(true);
  expect(errors).toEqual([]);
  console.log(
    'macOS UI bridge: permission states, explicit request, switch, startup ordering, compact dark layout; PDF rendered without native Promise.withResolvers and with Worker creation disabled.',
  );
} finally {
  await browser.close();
}
