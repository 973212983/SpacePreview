import { chromium, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import './reading-fixtures.mjs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const platform of ['windows', 'macos']) {
    const context = await browser.newContext({ viewport: { width: 1000, height: 760 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript((platform) => {
      let id = 0;
      let maximized = false;
      window.isTauri = true;
      window.nativeCalls = [];
      window.focusedClicks = 0;
      window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
      window.__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
        transformCallback: () => ++id,
        unregisterCallback() {},
        async invoke(command, args) {
          window.nativeCalls.push({ command, args });
          if (command === 'initial_paths') return { paths: [], text: false };
          if (command === 'agent_status')
            return { platform, supported: true, running: true, enabled: true };
          if (command === 'plugin:event|listen') return ++id;
          if (command === 'plugin:window|is_maximized') return maximized;
          if (command === 'plugin:window|toggle_maximize') maximized = !maximized;
          if (command === 'plugin:window|is_visible') return true;
          if (command === 'plugin:window|current_monitor') return null;
          if (command === 'plugin:updater|check') return null;
          if (command === 'autostart_enabled') return false;
        },
      };
    }, platform);
    await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1425');
    const preview = page.locator('.preview-layer:visible');
    const openText = async () => {
      await page.locator('input[type=file]').setInputFiles({
        name: 'focus.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Focus shortcut regression'),
      });
      await expect(preview.locator('.code-scroll')).toContainText('Focus shortcut regression');
    };
    const spaceCloses = async (button) => {
      await button.focus();
      await button.evaluate((element) => {
        element.addEventListener('click', () => window.focusedClicks++);
      });
      const before = await page.evaluate(() => ({
        clicks: window.focusedClicks,
        windowActions: window.nativeCalls.filter((call) =>
          ['plugin:window|minimize', 'plugin:window|toggle_maximize'].includes(call.command),
        ).length,
        closes: window.nativeCalls.filter((call) => call.command === 'hide_preview').length,
      }));
      await page.keyboard.down('Space');
      await page.keyboard.down('Space');
      await expect(preview).toBeVisible();
      await page.keyboard.up('Space');
      await expect(page.locator('.preview-layer')).toHaveCount(0);
      expect(await page.evaluate(() => window.focusedClicks)).toBe(before.clicks);
      expect(
        await page.evaluate(
          () => window.nativeCalls.filter((call) => call.command === 'hide_preview').length,
        ),
      ).toBe(before.closes + 1);
      expect(
        await page.evaluate(
          () =>
            window.nativeCalls.filter((call) =>
              ['plugin:window|minimize', 'plugin:window|toggle_maximize'].includes(call.command),
            ).length,
        ),
      ).toBe(before.windowActions);
    };
    if (platform === 'windows') {
      for (const selector of [
        '[title="最小化"]',
        '[aria-label="最大化"], [aria-label="恢复窗口"]',
        '[aria-label="最大化"], [aria-label="恢复窗口"]',
        '.close-button',
      ]) {
        await openText();
        const button = page.locator(selector);
        const command =
          selector === '.close-button'
            ? 'hide_preview'
            : selector.includes('最小化')
              ? 'plugin:window|minimize'
              : 'plugin:window|toggle_maximize';
        const before = await page.evaluate(
          (command) => window.nativeCalls.filter((call) => call.command === command).length,
          command,
        );
        await button.click();
        expect(
          await page.evaluate(
            (command) => window.nativeCalls.filter((call) => call.command === command).length,
            command,
          ),
        ).toBe(before + 1);
        // Pointer clicks must not leave a caption button focused or outlined.
        expect(await button.evaluate((element) => document.activeElement === element)).toBe(false);
        if (selector === '.close-button') await openText();
        await spaceCloses(button);
      }
    }
    for (const name of ['阅读体验.md', '样式文档.docx']) {
      await page
        .locator('input[type=file]')
        .setInputFiles(fileURLToPath(new URL(`../test-results/fixtures/${name}`, import.meta.url)));
      const heading = page.locator('.reading-outline nav button').first();
      await expect(heading).toBeVisible({ timeout: 20000 });
      await heading.click();
      await expect(heading).toHaveAttribute('aria-current', 'location');
      await spaceCloses(heading);
    }
    await openText();
    const more = page.getByTitle('更多选项', { exact: true });
    await more.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.dropdown')).toBeVisible();
    const search = page.getByRole('textbox', { name: '查找文本', exact: true });
    await search.focus();
    await page.keyboard.press('Space');
    await expect(search).toHaveValue(' ');
    await expect(preview).toBeVisible();
    await spaceCloses(more);
    expect(errors).toEqual([]);
    console.log(
      `${platform} PASS: ${platform === 'windows' ? 'caption pointer focus and actions, ' : ''}focused-button Space closes once, MD/Word outlines, Enter still activates buttons.`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
