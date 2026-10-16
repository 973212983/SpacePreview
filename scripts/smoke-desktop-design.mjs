import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  fs.mkdirSync('test-results', { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1424');
  const nav = (name) =>
    page.getByRole('navigation', { name: '设置分类' }).getByRole('button', { name, exact: true });
  await expect(page.getByRole('heading', { name: '使用指南', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /选择文件/ })).toHaveCount(0);
  await expect(page.locator('.example-file')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: '设置分类' }).getByRole('button')).toHaveCount(3);
  await nav('设置').click();
  for (const name of ['应用主题', '窗口与启动', '预览快捷键', '常用操作']) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('switch', { name: '开机自启动', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '修改 Windows 预览快捷键', exact: true })).toBeVisible();
  expect(
    await page
      .locator('.settings-brand img')
      .evaluate((img) => img.complete && img.naturalWidth > 0),
  ).toBe(true);
  for (const theme of ['浅色', '深色', '跟随系统']) {
    await nav('设置').click();
    await page.getByRole('button', { name: theme, exact: true }).click();
    if (theme === '跟随系统') await page.emulateMedia({ colorScheme: 'dark' });
    const name = theme === '浅色' ? 'light' : theme === '深色' ? 'dark' : 'system-dark';
    for (const [label, slug] of [
      ['使用指南', 'guide'],
      ['设置', 'preferences'],
      ['关于与更新', 'about'],
    ]) {
      await nav(label).click();
      await expect(nav(label)).toHaveAttribute('aria-current', 'page');
      await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible();
      await page.screenshot({
        path: `test-results/settings-${slug}-${name}.png`,
        animations: 'disabled',
      });
    }
    for (const size of [
      { width: 640, height: 480 },
      { width: 420, height: 640 },
    ]) {
      await page.setViewportSize(size);
      for (const label of ['使用指南', '设置', '关于与更新']) {
        await nav(label).click();
        expect(
          await page
            .locator('.settings-content')
            .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        ).toBe(true);
        await expect(nav('关于与更新')).toBeInViewport();
      }
      await expect(page.getByRole('button', { name: '检查更新', exact: true })).toBeDisabled();
      await nav('使用指南').click();
      if (size.width === 640)
        await page.screenshot({
          path: `test-results/settings-small-${name}.png`,
          animations: 'disabled',
        });
    }
    await page.setViewportSize({ width: 1000, height: 760 });
  }
  await page.locator('input[type=file]').setInputFiles({
    name: '界面检查.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('本地文件预览正常'),
  });
  await expect(page.locator('.file-title strong')).toHaveText('界面检查.txt');
  await expect(page.locator('.preview-container')).toContainText('本地文件预览正常');
  await page.getByTitle('更多选项', { exact: true }).click();
  await page.getByRole('button', { name: '偏好设置', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await nav('设置').click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.file-title strong')).toHaveText('界面检查.txt');
  await page.getByTitle('返回欢迎页').click();
  await nav('设置').click();
  await page.getByRole('button', { name: '浅色', exact: true }).click();
  await nav('使用指南').click();
  expect(errors).toEqual([]);
  console.log(
    'Design passed: guide-only start, three navigation entries with consolidated settings, selected icon, themes, 640/420px layouts, preview/settings round-trip.',
  );
} finally {
  await browser.close();
}
