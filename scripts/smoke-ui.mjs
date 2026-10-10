import { chromium, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import './extra-fixtures.mjs';
import { openPreviewMenu, closePreviewMenu } from './preview-menu.mjs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1420');
  const open = async (name) => {
    await page
      .locator('input[type=file]')
      .setInputFiles(fileURLToPath(new URL(`../test-results/fixtures/${name}`, import.meta.url)));
    await expect(page.locator('.file-title strong')).toHaveText(name);
  };
  const shot = async (name) =>
    page.screenshot({
      path: fileURLToPath(new URL(`../test-results/${name}.png`, import.meta.url)),
    });
  await open('阅读笔记.odt');
  await expect(page.locator('.document-paper')).toContainText('把时间留给内容');
  expect((await page.locator('.titlebar').boundingBox()).height).toBe(36);
  await expect(page.locator('.preview-footer')).toHaveCount(0);
  expect((await page.locator('.preview-container').boundingBox()).height).toBe(724);
  await shot('compact-document');
  await open('项目清单.csv');
  await expect(page.locator('.workbook-table')).toContainText('布局优化');
  await page.locator('.workbook-scroll').evaluate((el) => {
    el.scrollTop = 1700;
  });
  await expect(page.locator('.workbook-table')).toContainText('记录 65');
  await page.locator('.workbook-scroll').evaluate((el) => {
    el.scrollTop = 0;
  });
  await expect(page.getByRole('cell', { name: '布局优化', exact: true })).toBeVisible();
  await shot('compact-table');
  await open('预算.ods');
  await page.getByRole('tab', { name: '下月预算' }).click();
  await expect(page.locator('.workbook-table')).toContainText('2400');
  await open('概览.odp');
  await openPreviewMenu(page);
  await page.getByTitle('下一张幻灯片').click();
  await expect(page.locator('.slide-paper')).toContainText('更多文件格式');
  await open('阅读时光.epub');
  await openPreviewMenu(page);
  await page.getByLabel('选择电子书章节').selectOption('1');
  await closePreviewMenu(page);
  await expect(page.locator('.document-paper')).toContainText('第二章');
  await shot('compact-book');
  await page.setViewportSize({ width: 640, height: 480 });
  await expect(page.locator('.titlebar')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await shot('compact-small');
  await page.getByTitle('更多选项', { exact: true }).click();
  await page.getByRole('button', { name: '偏好设置', exact: true }).click();
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await page.keyboard.press('Escape');
  await shot('compact-dark');
  expect(errors).toEqual([]);
  console.log(
    'UI checks passed: compact dimensions, ODT, CSV virtualization, ODS sheets, ODP slides, EPUB chapters, small window, dark theme.',
  );
} finally {
  await browser.close();
}
