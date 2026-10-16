import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const url = process.env.UI_TEST_URL || 'http://127.0.0.1:1423';
const csp = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8')).app.security.csp;
const errors = [];
fs.mkdirSync('test-results', { recursive: true });

async function open(mode = 'available', desktop = true) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(url + '/**', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'content-security-policy': csp },
    });
  });
  await page.clock.install();
  if (desktop)
    await page.addInitScript((mode) => {
      let id = 0;
      window.isTauri = true;
      window.updateMode = mode;
      window.updateCalls = [];
      window.restartFails = false;
      window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
      window.__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
        transformCallback() {
          return ++id;
        },
        unregisterCallback() {},
        async invoke(command, args) {
          window.updateCalls.push({ command, rid: args?.rid });
          if (command === 'plugin:event|listen') return ++id;
          if (command === 'plugin:window|is_maximized' || command === 'autostart_enabled')
            return false;
          if (command === 'agent_status') return { supported: true, enabled: true, running: true };
          if (command === 'initial_paths') return { paths: [], text: false };
          if (command === 'plugin:updater|check') {
            if (window.updateMode === 'offline') throw new Error('request timeout');
            if (window.updateMode === 'current') return null;
            const metadata = {
              rid: ++id,
              currentVersion: '0.10.7',
              version: '0.11.0',
              body: '修复预览问题\n<img src=x onerror=alert(1)>',
              rawJson: {},
            };
            if (window.updateMode === 'pending')
              return new Promise((resolve) => {
                window.resolveCheck = () => resolve(metadata);
              });
            return metadata;
          }
          if (command === 'plugin:updater|download_and_install') {
            window.updateEvent = (event) => args.onEvent.onmessage(event);
            return new Promise((resolve, reject) => {
              window.finishInstall = resolve;
              window.failInstall = () => reject(new Error('signature verification failed'));
            });
          }
          if (command === 'plugin:process|restart' && window.restartFails)
            throw new Error('restart failed');
        },
      };
    }, mode);
  await page.goto(url);
  await expect(page.getByRole('button', { name: '关于与更新', exact: true })).toBeVisible();
  return page;
}
const settings = (page) => page.getByRole('button', { name: '关于与更新', exact: true }).click();
const calls = (page, command) =>
  page.evaluate(
    (command) => window.updateCalls.filter((call) => call.command === command).length,
    command,
  );

try {
  const web = await open('available', false);
  await settings(web);
  await expect(web.getByRole('button', { name: '检查更新', exact: true })).toBeDisabled();
  await expect(web.getByLabel('软件更新')).toContainText('仅在桌面版中可用');
  await web.close();

  const current = await open('current');
  await current.clock.fastForward(10_100);
  await settings(current);
  await expect(current.getByLabel('软件更新')).toContainText('当前已是最新版本');
  expect(await calls(current, 'plugin:updater|check')).toBe(1);
  await current.getByRole('button', { name: '检查更新', exact: true }).click();
  await expect(current.getByLabel('软件更新')).toContainText('当前已是最新版本');
  expect(await calls(current, 'plugin:updater|check')).toBe(2);
  await current.close();

  const pending = await open('pending');
  await settings(pending);
  await pending.getByRole('button', { name: '检查更新', exact: true }).evaluate((button) => {
    button.click();
    button.click();
  });
  await expect(pending.getByRole('button', { name: '检查中…' })).toBeDisabled();
  await pending.clock.fastForward(10_100);
  expect(await calls(pending, 'plugin:updater|check')).toBe(1);
  await pending.evaluate(() => window.resolveCheck());
  await expect(pending.getByRole('button', { name: '下载并安装' })).toBeVisible();
  await pending.close();

  const offline = await open('offline');
  await offline.clock.fastForward(10_100);
  await expect(offline.locator('.update-notice')).toHaveCount(0);
  await settings(offline);
  await expect(offline.getByRole('alert')).toContainText('暂时无法检查更新');
  await offline.evaluate(() => {
    window.updateMode = 'available';
  });
  await offline.getByRole('button', { name: '检查更新', exact: true }).click();
  await expect(offline.getByRole('button', { name: '下载并安装' })).toBeVisible();
  await offline.close();

  const notice = await open();
  await notice.setViewportSize({ width: 640, height: 480 });
  await notice.clock.fastForward(10_100);
  await notice.getByRole('button', { name: '查看更新' }).click();
  await notice.clock.runFor(32);
  await expect(notice.getByRole('button', { name: '下载并安装' })).toBeInViewport();
  await notice.close();

  const page = await open();
  await page.clock.fastForward(10_100);
  await expect(page.locator('.update-notice')).toContainText('v0.11.0');
  expect(await calls(page, 'plugin:updater|download_and_install')).toBe(0);
  await page.getByRole('button', { name: '稍后更新' }).click();
  await expect(page.locator('.update-notice')).toHaveCount(0);
  await settings(page);
  await page.getByText('更新内容', { exact: true }).click();
  await expect(page.locator('.update-details pre')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.update-details img')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/updater-available.png' });
  // Rechecking releases the previous native resource without installing anything.
  await page.getByRole('button', { name: '检查更新', exact: true }).click();
  await expect(page.getByRole('button', { name: '下载并安装' })).toBeVisible();
  expect(await calls(page, 'plugin:resources|close')).toBe(1);
  await page.getByRole('button', { name: '下载并安装' }).evaluate((button) => {
    button.click();
    button.click();
  });
  await expect(page.getByLabel('软件更新')).toContainText('正在下载');
  expect(await calls(page, 'plugin:updater|download_and_install')).toBe(1);
  await page.evaluate(() => {
    window.updateEvent({ event: 'Started', data: { contentLength: 100 } });
    window.updateEvent({ event: 'Progress', data: { chunkLength: 35 } });
  });
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '35');
  await page.getByRole('button', { name: '使用指南', exact: true }).click();
  await settings(page);
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '35');
  await page.evaluate(() => {
    window.updateEvent({ event: 'Finished' });
  });
  await expect(page.getByLabel('软件更新')).toContainText('正在校验并安装');
  await page.evaluate(() => window.failInstall());
  await expect(page.getByRole('alert')).toContainText('签名校验');
  expect(await calls(page, 'plugin:process|restart')).toBe(0);
  await page.getByRole('button', { name: '重试下载安装' }).click();
  await page.evaluate(() => {
    window.updateEvent({ event: 'Started', data: {} });
    window.updateEvent({ event: 'Progress', data: { chunkLength: 4096 } });
  });
  await expect(page.getByRole('progressbar')).not.toHaveAttribute('value');
  await expect(page.getByLabel('软件更新')).toContainText('4 KB');
  await page.setViewportSize({ width: 640, height: 480 });
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await settings(page);
  await page.getByLabel('软件更新').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/updater-small-dark.png' });
  expect(
    await page
      .locator('.settings-dialog')
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.evaluate(() => {
    window.restartFails = true;
    window.finishInstall();
  });
  await expect(page.getByRole('alert')).toContainText('自动重启失败');
  await expect(page.getByRole('button', { name: '重试下载安装' })).toHaveCount(0);
  expect(await calls(page, 'plugin:process|restart')).toBe(1);
  await page.evaluate(() => {
    window.restartFails = false;
  });
  await page.getByRole('button', { name: '重启瞬览' }).click();
  expect(await calls(page, 'plugin:process|restart')).toBe(2);
  expect(await calls(page, 'plugin:updater|download_and_install')).toBe(2);
  await page.close();
  expect(errors).toEqual([]);
  console.log(
    'Updater UI passed: browser fallback, startup/manual checks, offline retry, duplicate suppression, resource cleanup, safe notes, download progress, signature/install failure, restart retry, small/dark layout.',
  );
} finally {
  await browser.close();
}
