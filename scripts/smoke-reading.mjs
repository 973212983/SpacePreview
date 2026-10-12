import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import './reading-fixtures.mjs';
import { openPreviewMenu, closePreviewMenu } from './preview-menu.mjs';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
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
  await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1420');
  const open = async (name) => {
    await page
      .locator('input[type=file]')
      .setInputFiles(fileURLToPath(new URL(`../test-results/fixtures/${name}`, import.meta.url)));
    await expect(page.locator('.file-title strong')).toHaveText(name);
  };
  await open('license.dat');
  await expect(page.locator('.code-scroll')).toContainText('授权状态：有效');
  await expect(page.locator('.plain-text .code-scroll pre')).toHaveCSS('font-size', '16px');
  await expect(page.locator('.code-scroll')).toHaveClass(/wrap/);
  await page.screenshot({ path: 'test-results/typography-text.png' });
  await open('editor.ts');
  await expect(page.locator('.source-code .code-scroll pre')).toHaveCSS('font-size', '16px');
  await expect(page.locator('.code-line code').first()).toHaveCSS('font-family', /JetBrains Mono/);
  await expect(page.locator('.hljs-keyword').first()).toHaveCSS('color', 'rgb(0, 51, 179)');
  await page.screenshot({ path: 'test-results/typography-code.png' });
  await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
  await expect(page.locator('.hljs-keyword').first()).toHaveCSS('color', 'rgb(207, 142, 109)');
  await page.screenshot({ path: 'test-results/typography-code-dark.png' });
  await page.evaluate(() => (document.documentElement.dataset.theme = 'light'));
  await open('unicode.txt');
  await expect(page.locator('.code-scroll')).toContainText('中文内容没有乱码');
  await open('gbk.txt');
  await expect(page.locator('.code-scroll')).toContainText('中文');
  await open('western.txt');
  await expect(page.locator('.code-scroll')).toBeVisible();
  await page.getByTitle('更多选项', { exact: true }).click();
  await page.getByLabel('文本编码').selectOption('windows-1252');
  await expect(page.locator('.code-scroll')).toContainText('café');
  await expect(page.getByLabel('文本编码')).toHaveValue('windows-1252');
  await page.getByLabel('关闭更多选项').click({ position: { x: 10, y: 100 } });
  await open('阅读体验.md');
  await expect(page.locator('.reading-outline button')).toContainText([
    '',
    '留白，让阅读更从容',
    '清晰的层级',
    '今日清单',
    '数据一览',
    '代码示例',
  ]);
  await expect(page.locator('.prose input[type=checkbox]').first()).toBeChecked();
  await expect(page.locator('.prose .hljs-keyword')).toHaveCount(1);
  await page.locator('.reading-outline nav').getByText('数据一览').click();
  await expect(page.locator('.prose h2').filter({ hasText: '数据一览' })).toBeInViewport();
  await page.locator('.reading-outline nav').getByText('留白，让阅读更从容').click();
  await expect(page.locator('.reading-outline [aria-current="location"]')).toHaveText(
    '留白，让阅读更从容',
  );
  await page.screenshot({ path: 'test-results/reading-markdown.png' });
  const start = Date.now();
  await open('样式文档.docx');
  const doc = page.frameLocator('iframe[title="Word 原样预览"]');
  await expect(doc.locator('section.docx')).toHaveCount(2, { timeout: 20000 });
  expect(
    await doc.locator('html').evaluate((el) => getComputedStyle(el, '::-webkit-scrollbar').width),
  ).toBe('5px');
  await expect(page.locator('.reading-outline nav button')).toHaveText([
    '保持文档原有的表达',
    '本周重点',
    '下一页计划',
  ]);
  await expect(doc.locator('.word-heading-0 span').first()).toHaveCSS('color', 'rgb(40, 94, 128)');
  await expect(doc.locator('td').first()).toHaveCSS('background-color', 'rgb(234, 243, 255)');
  await expect(doc.locator('.docx-wrapper')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(doc.locator('img')).toHaveCount(1);
  expect(await doc.locator('img').evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(
    true,
  );
  console.log(
    `Styled DOCX fixture rendered in ${Date.now() - start}ms (synthetic fixture, not a general benchmark).`,
  );
  await page.screenshot({ path: 'test-results/reading-word.png' });
  await page.locator('.reading-outline nav').getByText('下一页计划').click();
  await expect(doc.locator('.word-heading-2')).toBeInViewport();
  await expect(page.locator('.reading-outline [aria-current="location"]')).toHaveText('下一页计划');
  await doc.locator('html').evaluate((el) => el.scrollTo(0, 0));
  await expect(page.locator('.reading-outline [aria-current="location"]')).toHaveText(
    '保持文档原有的表达',
  );
  await openPreviewMenu(page);
  await page.getByLabel('Word 缩放').selectOption('1.25');
  await closePreviewMenu(page);
  await page.getByTitle('收起大纲').click();
  await expect(page.locator('.reading-outline')).toHaveCount(0);
  await openPreviewMenu(page);
  await page.getByTitle('切换文档大纲').click();
  await closePreviewMenu(page);
  await page.locator('.reading-outline nav').getByText('下一页计划').click();
  await expect(page.locator('.reading-outline [aria-current="location"]')).toHaveText('下一页计划');
  await doc.locator('.word-heading-2').click();
  await page.keyboard.press('Space');
  await expect(page.locator('.welcome')).toBeVisible();
  await open('样式文档.docx');
  await openPreviewMenu(page);
  await page.getByRole('button', { name: '文字速览', exact: true }).click();
  await expect(page.locator('.document-paper')).toContainText('保持文档原有的表达');
  await page.getByRole('button', { name: '页面预览', exact: true }).click();
  await expect(doc.locator('section.docx')).toHaveCount(2);
  await open('主题字体.docx');
  await expect(doc.locator('.word-heading-0 span').first()).toHaveCSS('font-family', /宋体/);
  await page.screenshot({ path: 'test-results/typography-word.png' });
  await open('rich.rtf');
  const rtf = page.frameLocator('iframe[title="RTF 富文本预览"]');
  await expect(rtf.locator('body')).toContainText('中文', { timeout: 15000 });
  await expect(rtf.getByText('Bold content', { exact: true })).toHaveCSS('font-weight', '700');
  await open('安全阅读.html');
  await expect(page.locator('.code-scroll')).toContainText('<h1>HTML 阅读</h1>');
  await openPreviewMenu(page);
  await page.getByLabel('HTML 视图').selectOption('web');
  await page.getByRole('button', { name: '阅读模式', exact: true }).click();
  await expect(page.locator('.document-paper')).toContainText('保留文档内容');
  await expect(page.locator('.reading-outline nav button')).toHaveText(['HTML 阅读']);
  await expect(
    page.locator('.document-paper script, .document-paper img, .document-paper form'),
  ).toHaveCount(0);
  expect(await page.evaluate(() => window.untrustedRan)).toBeUndefined();
  await page.locator('input[type=file]').setInputFiles({
    name: '长文大纲.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(
      '# 第一章\n\n' + '段落内容。\n\n'.repeat(35) + '## 第二章\n\n' + '继续阅读。\n\n'.repeat(35),
    ),
  });
  await expect(page.locator('.reading-outline [aria-current="location"]')).toHaveText('第一章');
  await page.locator('.prose h2').evaluate((heading) => heading.scrollIntoView());
  await expect(page.locator('.reading-outline [aria-current="location"]')).toHaveText('第二章');
  await page.locator('.document-scroll').evaluate((el) => el.scrollTo(0, 0));
  await expect(page.locator('.reading-outline [aria-current="location"]')).toHaveText('第一章');
  expect(errors).toEqual([]);
  console.log(
    'Reading UI passed: content sniffing, UTF16/GBK/manual encoding, Markdown outline/GFM/highlighting, DOCX outline/pages/style/table/image/Space close, RTF Unicode/bold, native CSP.',
  );
} finally {
  await browser.close();
}
