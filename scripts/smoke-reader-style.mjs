import { chromium, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import './reading-fixtures.mjs';
import { openPreviewMenu, closePreviewMenu } from './preview-menu.mjs';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1423');
  const open = async (name) =>
    page
      .locator('input[type=file]')
      .setInputFiles(fileURLToPath(new URL(`../test-results/fixtures/${name}`, import.meta.url)));
  await open('阅读体验.md');
  await expect(page.locator('.document-paper')).toHaveCSS('font-size', '18px');
  await page.getByTitle('更多选项', { exact: true }).click();
  await page.getByLabel('阅读字号').selectOption('20');
  await expect(page.locator('.document-paper')).toHaveCSS('font-size', '20px');
  await expect(page.locator('.prose h1')).toHaveCSS('font-size', '40px');
  await page.getByLabel('阅读字体').selectOption('serif');
  await expect(page.locator('.document-paper')).toHaveCSS('font-family', /SimSun/);
  await page.getByLabel('阅读字体').selectOption('sans');
  await page.getByLabel('阅读字号').selectOption('16');
  await page.getByLabel('关闭更多选项').click({ position: { x: 10, y: 100 } });
  const separator = page.getByRole('separator', { name: '调整大纲宽度' });
  const box = await separator.boundingBox();
  await page.mouse.move(box.x + 3, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 51, box.y + 100);
  await page.mouse.up();
  await expect(separator).toHaveAttribute('aria-valuenow', '268');
  await separator.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(separator).toHaveAttribute('aria-valuenow', '252');
  await expect(page.locator('.file-title strong')).toHaveText('阅读体验.md');
  await page.screenshot({ path: 'test-results/reader-typora.png' });
  await page.locator('input[type=file]').setInputFiles({
    name: '长篇大纲.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(
      Array.from(
        { length: 80 },
        (_, i) => `## 第 ${i + 1} 章\n\n` + '阅读段落。\n\n'.repeat(8),
      ).join('\n'),
    ),
  });
  await expect(page.locator('.reading-outline nav button')).toHaveCount(80);
  await page
    .locator('.prose h2')
    .nth(59)
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect(page.locator('.reading-outline [aria-current=location]')).toHaveText('第 60 章');
  await expect(page.locator('.reading-outline [aria-current=location]')).toBeInViewport();
  expect(await page.locator('.reading-outline nav').evaluate((el) => el.scrollTop)).toBeGreaterThan(
    0,
  );
  await page.getByLabel('搜索文档标题').fill('第 60 章');
  await expect(page.locator('.reading-outline nav button')).toHaveCount(1);
  await page.getByLabel('搜索文档标题').fill('不存在');
  await expect(page.locator('.outline-empty')).toHaveText('没有匹配的标题');
  await open('样式文档.docx');
  const word = page.frameLocator('iframe[title="Word 原样预览"]');
  await openPreviewMenu(page);
  await expect(page.getByLabel('文档页数')).toHaveText('1 / 2 页');
  await closePreviewMenu(page);
  await page.locator('.reading-outline nav').getByText('下一页计划').click();
  await openPreviewMenu(page);
  await expect(page.getByLabel('文档页数')).toHaveText('2 / 2 页');
  await closePreviewMenu(page);
  await page.locator('.reading-outline nav').getByText('保持文档原有的表达').click();
  await expect(word.locator('.word-heading-0 span').first()).toHaveCSS('font-family', /Calibri/);
  await page.screenshot({ path: 'test-results/reader-office.png' });
  await open('阅读时光.fb2');
  await expect(page.locator('.reading-outline nav button')).toHaveText([
    '阅读时光',
    '第一章：留白',
    '第二章：前行',
  ]);
  await expect(page.locator('.prose em')).toHaveText('安静');
  await open('分析笔记.ipynb');
  await expect(page.locator('.reading-outline nav button')).toHaveText(['分析笔记', '保存的结论']);
  await expect(page.locator('.notebook-output')).toHaveText('你好，Notebook\n');
  await expect(page.locator('.notebook-cell .hljs-built_in')).toContainText('print');
  await page.screenshot({ path: 'test-results/reader-notebook.png' });
  await page.setViewportSize({ width: 640, height: 480 });
  await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
  await open('阅读体验.md');
  await expect(page.getByTitle('更多选项', { exact: true })).toBeInViewport();
  await expect(page.locator('.prose h1')).toBeInViewport();
  await page.getByTitle('更多选项', { exact: true }).click();
  await expect(page.locator('.dropdown select')).toHaveCount(3);
  await page.screenshot({ path: 'test-results/menu-small-dark.png' });
  await page.getByLabel('关闭更多选项').click({ position: { x: 10, y: 100 } });
  await page.screenshot({ path: 'test-results/reader-small-dark.png' });
  expect(errors).toEqual([]);
  console.log(
    'Reader style passed: font/size, sidebar pointer/keyboard resizing, long outline tracking/search, Word page count/fonts, FB2, Notebook, small dark UI.',
  );
} finally {
  await browser.close();
}
