import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1420');
  const markdown = [
    '[跳转末章](#第-1200-章)',
    ...Array.from({ length: 1200 }, (_, index) => `## 第 ${index + 1} 章\n\n章节正文 ${index + 1}`),
    ...Array.from({ length: 30 }, (_, index) => `末章补充段落 ${index + 1}`),
  ].join('\n\n');
  await page.locator('input[type=file]').setInputFiles({
    name: '1200-chapters.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(markdown),
  });
  const outline = page.getByRole('complementary', { name: '文档大纲' });
  const buttons = outline.locator('nav button');
  await expect(outline.locator('.outline-caption span')).toHaveText('1200', { timeout: 20000 });
  await expect(buttons).toHaveCount(1200);
  await expect(page.locator('.prose h2')).toHaveCount(1200);
  const lastHeading = page.locator('#reader-heading-1199');
  await expect(lastHeading).toHaveText('第 1200 章');
  await page.getByRole('link', { name: '跳转末章', exact: true }).click();
  await expect(lastHeading).toBeInViewport();
  await expect(outline.locator('[aria-current="location"]')).toHaveText('第 1200 章');
  const search = outline.getByRole('textbox', { name: '搜索文档标题' });
  await search.fill('第 1200 章');
  await expect(buttons).toHaveCount(1);
  await buttons.click();
  await expect(lastHeading).toBeInViewport();
  await search.fill('第 1001 章');
  await buttons.click();
  await expect(page.locator('#reader-heading-1000')).toBeInViewport();
  await search.fill('没有这个章节');
  await expect(outline).toContainText('没有匹配的标题');
  await search.fill('');
  await expect(buttons).toHaveCount(1200);
  await page.screenshot({ path: 'test-results/markdown-1200-outline.png' });
  await page.locator('.prose').click({ position: { x: 200, y: 40 } });
  await page.keyboard.press('Space');
  await expect(page.locator('.preview-layer')).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log(
    'Markdown outline PASS: all 1200 headings, anchors, last-chapter search/navigation, filtering, close.',
  );
} finally {
  await browser.close();
}
