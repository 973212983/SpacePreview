import { chromium, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import './reading-fixtures.mjs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const platform of ['windows', 'macos']) {
    const context = await browser.newContext({ viewport: { width: 1000, height: 760 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((platform) => {
      let id = 0;
      window.isTauri = true;
      window.nativeCalls = [];
      window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
      window.__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
        transformCallback() {
          return ++id;
        },
        unregisterCallback() {},
        async invoke(command, args) {
          window.nativeCalls.push({ command, args });
          if (command === 'agent_status')
            return {
              supported: true,
              enabled: true,
              running: platform !== 'macos',
              platform,
              accessibility: false,
              automation: false,
            };
          if (command === 'initial_paths') return { paths: [], text: false };
          if (command === 'plugin:event|listen') return ++id;
          if (command === 'plugin:window|is_maximized') return false;
        },
      };
    }, platform);
    await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1423');
    const openSettings = async () => {
      await page.getByTitle('更多选项', { exact: true }).click();
      await page.getByRole('button', { name: '偏好设置', exact: true }).click();
    };
    await openSettings();
    await expect(page.locator('.settings-dialog')).toBeVisible();
    if (platform === 'macos') await expect(page.locator('.mac-permissions')).toBeVisible();
    expect(
      await page.locator('.settings-dialog').evaluate((e) => e.scrollHeight <= e.clientHeight + 1),
    ).toBe(true);
    const target = platform === 'macos' ? 'macOS' : 'Windows';
    const record = page.getByRole('button', { name: `修改 ${target} 预览快捷键`, exact: true });
    await record.click();
    await page.keyboard.press('Control+o');
    await expect(page.getByRole('alert')).toContainText('用于选择文件');
    await page.keyboard.press('Escape');
    await expect(page.locator('.settings-dialog')).toBeVisible();
    await expect(record).toHaveText('Space');
    await record.click();
    await page.keyboard.press('F8');
    await expect(record).toHaveText('F8');
    const savedKey = platform === 'macos' ? 'macosShortcut' : 'windowsShortcut';
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('space-settings')));
    expect(saved[savedKey]).toEqual({ code: 'F8', ctrl: false, alt: false, meta: false });
    expect(saved[platform === 'macos' ? 'windowsShortcut' : 'macosShortcut'].code).toBe('Space');
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.nativeCalls.filter((c) => c.command === 'set_agent_shortcut').at(-1)?.args
              .shortcut.code,
        ),
      )
      .toBe('F8');
    await page.screenshot({ path: `test-results/settings-${platform}.png` });
    await page.setViewportSize({ width: 640, height: 480 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: '深色', exact: true }).click();
    await page.getByRole('button', { name: '关闭设置', exact: true }).click();
    await page.reload();
    await openSettings();
    await expect(record).toHaveText('F8');
    await page.getByRole('button', { name: '关闭设置', exact: true }).click();
    const openFile = async (name) => {
      await page
        .locator('input[type=file]')
        .setInputFiles(fileURLToPath(new URL(`../test-results/fixtures/${name}`, import.meta.url)));
      await expect(page.locator('.file-title strong')).toHaveText(name);
    };
    await openFile('license.dat');
    await page.locator('.preview-container').click({ position: { x: 400, y: 220 } });
    await page.keyboard.press('Space');
    await expect(page.locator('.file-title strong')).toHaveText('license.dat');
    await page.keyboard.down('F8');
    await page.keyboard.down('F8');
    await expect(page.locator('.file-title strong')).toHaveText('license.dat');
    await page.keyboard.up('F8');
    await expect(page.locator('.welcome')).toBeVisible();
    await openFile('license.dat');
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F8', code: '', cancelable: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'F8', code: '', cancelable: true }));
    });
    await expect(page.locator('.welcome')).toBeVisible();
    await openSettings();
    await record.click();
    const combination = platform === 'macos' ? 'Meta+p' : 'Control+Alt+p';
    await page.keyboard.press(combination);
    await expect(record).toHaveText(platform === 'macos' ? '⌘ + P' : 'Ctrl + Alt + P');
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.nativeCalls.filter((c) => c.command === 'set_agent_shortcut').at(-1)?.args
              .shortcut,
        ),
      )
      .toEqual({
        code: 'KeyP',
        ctrl: platform !== 'macos',
        alt: platform !== 'macos',
        meta: platform === 'macos',
      });
    await page.getByRole('button', { name: '关闭设置', exact: true }).click();
    for (const [name, frame] of [
      ['样式文档.docx', 'iframe[title="Word 原样预览"]'],
      ['安全阅读.html', 'iframe[title="HTML 网页预览"]'],
    ]) {
      await openFile(name);
      await expect(page.locator(frame)).toBeVisible();
      if (name.endsWith('.docx'))
        await expect(page.frameLocator(frame).locator('section.docx')).toHaveCount(2, {
          timeout: 20000,
        });
      await page
        .frameLocator(frame)
        .locator('body')
        .click({ position: { x: 100, y: 100 } });
      await page.keyboard.press('Control+F8');
      await expect(page.locator('.file-title strong')).toHaveText(name);
      await page.keyboard.press(combination);
      await expect(page.locator('.welcome')).toBeVisible();
    }
    await openSettings();
    await page.getByRole('button', { name: `恢复 ${target} 默认快捷键`, exact: true }).click();
    await expect(record).toHaveText('Space');
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.nativeCalls.filter((c) => c.command === 'set_agent_shortcut').at(-1)?.args
              .shortcut.code,
        ),
      )
      .toBe('Space');
    expect(errors).toEqual([]);
    console.log(
      `${platform}: layout, recording, persistence, exact modifiers, release-once and document-frame shortcuts passed`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
