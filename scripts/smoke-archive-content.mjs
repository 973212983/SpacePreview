import { chromium, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { zipSync, strToU8 } from 'fflate';

const entries = {
  'picture.svg': strToU8(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#168ed0"/></svg>',
  ),
  'picture.png': new Uint8Array(
    await readFile(new URL('../src-tauri/icons/icon.png', import.meta.url)),
  ),
  'notes.md': strToU8('# Archive heading\n\nMarkdown inside ZIP.\n\n## Details\n\nMore content.'),
  'notes.txt': strToU8('压缩包内文本内容'),
  'code.ts': strToU8('const archiveContent = true;'),
  'table.csv': strToU8('名称,数量\n预览,2'),
  'page.html': strToU8('<h1>ZIP 网页内容</h1><p>网页正文</p>'),
  'word.docx': new Uint8Array(
    await readFile(new URL('../test-results/fixtures/样式文档.docx', import.meta.url)),
  ),
  'document.pdf': new Uint8Array(
    await readFile(new URL('../test-results/fixtures/smoke.pdf', import.meta.url)),
  ),
  'unknown.bin': new Uint8Array([0, 1, 2, 3, 0, 255]),
  'large.txt': strToU8('Large archive text\n' + 'a'.repeat(9 * 1024 * 1024)),
};
const archive = Buffer.from(zipSync(entries));
await writeFile(new URL('../test-results/fixtures/内部文件预览.zip', import.meta.url), archive);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
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
  await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1423');
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: '内部文件预览.zip', mimeType: 'application/zip', buffer: archive });
  const list = page.locator('.archive-preview:visible .archive-list');
  const row = (name) => list.locator('.archive-row').filter({ hasText: name });
  const open = async (name) => {
    await row(name).dblclick();
    await expect(page.locator('.file-title strong')).toHaveText(name);
  };
  const back = async (name) => {
    await page.locator('.archive-back-button').click();
    await expect(row(name)).toHaveAttribute('aria-selected', 'true');
  };
  const menuOptions = async (count) => {
    await page.getByTitle('更多选项', { exact: true }).click();
    await expect(page.locator('.dropdown select')).toHaveCount(count);
    await page.getByLabel('关闭更多选项').click({ position: { x: 10, y: 100 } });
  };
  await menuOptions(0);
  for (const name of ['picture.svg', 'picture.png']) {
    await open(name);
    await expect
      .poll(() => page.locator('.image-preview img').evaluate((img) => img.naturalWidth))
      .toBeGreaterThan(0);
    await menuOptions(0);
    await page.screenshot({ path: `test-results/archive-${name}.png` });
    await back(name);
  }
  await open('notes.md');
  await expect(page.locator('.document-paper')).toContainText('Markdown inside ZIP');
  await menuOptions(3);
  await expect(page.locator('.reading-outline nav button.active')).toHaveCSS('box-shadow', 'none');
  await back('notes.md');
  await menuOptions(0);
  await open('word.docx');
  await expect(
    page.frameLocator('iframe[title="Word 原样预览"]').locator('section.docx'),
  ).toHaveCount(2);
  await menuOptions(1);
  await expect(page.locator('.reading-outline nav button.active')).toHaveCSS('box-shadow', 'none');
  await back('word.docx');
  await open('notes.txt');
  await expect(page.locator('.code-scroll')).toContainText('压缩包内文本内容');
  await menuOptions(1);
  await back('notes.txt');
  await menuOptions(0);
  await open('code.ts');
  await expect(page.locator('.code-scroll')).toContainText('archiveContent');
  await back('code.ts');
  await open('table.csv');
  await expect(page.locator('.workbook-preview')).toContainText('预览');
  await back('table.csv');
  await open('page.html');
  await expect(page.frameLocator('iframe[title="HTML 网页预览"]').locator('body')).toContainText(
    'ZIP 网页内容',
  );
  await back('page.html');
  await open('document.pdf');
  await page.getByTitle('更多选项', { exact: true }).click();
  await expect(page.locator('.pdf-toolbar')).toContainText('PDF · 1 页');
  await page.getByLabel('关闭更多选项').click({ position: { x: 10, y: 100 } });
  await expect
    .poll(() =>
      page.locator('.pdf-preview canvas').evaluate((canvas) => {
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        return pixels.some(
          (value, index) => index % 4 !== 3 && pixels[index - (index % 4) + 3] > 0 && value < 150,
        );
      }),
    )
    .toBe(true);
  await back('document.pdf');
  await open('unknown.bin');
  await expect(page.locator('.binary-preview')).toContainText('unknown.bin');
  await back('unknown.bin');
  await open('large.txt');
  await expect(page.locator('.continuous-content')).toContainText('Large archive text');
  await expect(page.locator('.continuous-content')).toHaveText(
    'Large archive text\n' + 'a'.repeat(9 * 1024 * 1024),
  );
  await back('large.txt');
  expect(errors).toEqual([]);
  console.log(
    'Archive content passed: SVG/PNG, MD/Word outline style, text/code/CSV/HTML/PDF, binary fallback, >8 MB text, return selection, desktop CSP.',
  );
} finally {
  await browser.close();
}
