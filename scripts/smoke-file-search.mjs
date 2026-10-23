import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { zipSync, strToU8 } from 'fflate';
import './reading-fixtures.mjs';

function pdfFixture() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [4 0 R 6 0 R 8 0 R] /Count 3 >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  for (let page = 1; page <= 3; page++) {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 3 0 R >> >> /Contents ${objects.length + 2} 0 R >>`,
    );
    const stream = `BT /F1 16 Tf 40 720 Td (Page ${page} ${page === 3 ? 'OnlyOnPageThree' : 'normal text'}) Tj ET`;
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const csp = JSON.parse(await readFile('src-tauri/tauri.conf.json', 'utf8')).app.security.csp;
  await page.route('**/', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'content-security-policy': csp },
    });
  });
  await page.addInitScript(() => {
    localStorage.setItem('preview-preferences', JSON.stringify({ html: 'web' }));
    window.findKeyResults = [];
    window.addEventListener(
      'keydown',
      (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f')
          setTimeout(() => window.findKeyResults.push(event.defaultPrevented), 0);
      },
      true,
    );
  });
  await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1420');
  const input = page.getByRole('textbox', { name: '查找当前文件', exact: true });
  const bar = page.getByRole('search', { name: '文件内检索' });
  const open = async (name, buffer) => {
    await page
      .locator('input[type=file]')
      .setInputFiles({ name, mimeType: 'application/octet-stream', buffer });
    await expect(page.locator('.file-title strong')).toHaveText(name);
    await expect(bar).toHaveCount(0);
  };
  await open('search.ts', Buffer.from('const alpha = 1;\nconst ALPHA = 2;\n// 中文 a+b'));
  await expect(page.locator('.code-scroll')).toContainText('中文');
  await page.keyboard.press('Control+f');
  await expect(input).toBeFocused();
  await input.fill('alpha');
  await expect(bar.getByRole('status')).toHaveText('1 / 2');
  await page.keyboard.press('Enter');
  await expect(bar.getByRole('status')).toHaveText('2 / 2');
  await page.keyboard.press('Shift+Enter');
  await expect(bar.getByRole('status')).toHaveText('1 / 2');
  await input.fill('a+b');
  await expect(bar.getByRole('status')).toHaveText('1 / 1');
  await page.keyboard.press('Escape');
  await expect(bar).toHaveCount(0);
  await expect(page.locator('.code-scroll')).toBeVisible();

  await open(
    'search.md',
    Buffer.from(
      Array.from({ length: 12 }, (_, i) => `## Heading ${i}\n\nBody token ${i}`).join('\n\n'),
    ),
  );
  await expect(page.locator('.reading-outline nav button')).toHaveCount(12);
  const outline = page.getByRole('textbox', { name: '搜索文档标题' });
  await outline.fill('Heading 11');
  await expect(page.locator('.reading-outline nav button')).toHaveCount(1);
  await expect(outline).toHaveCSS('outline-style', 'none');
  await page.getByRole('button', { name: '清空目录搜索' }).click();
  await expect(outline).toHaveValue('');
  await expect(outline).toBeFocused();
  await expect(page.locator('.reading-outline nav button')).toHaveCount(12);
  await page.keyboard.press('Meta+f');
  await input.fill('Body token');
  await expect(bar.getByRole('status')).toHaveText('1 / 12');
  await page.screenshot({ path: 'test-results/file-search-md.png' });

  await open('search.docx', await readFile('test-results/fixtures/样式文档.docx'));
  const word = page.frameLocator('iframe[title="Word 原样预览"]');
  await expect(word.locator('section.docx').first()).toBeVisible({ timeout: 20000 });
  await word.locator('body').click({ position: { x: 60, y: 80 } });
  await page.keyboard.press('Control+f');
  await expect(input).toBeFocused();
  await input.fill('保持文档');
  await expect(bar.getByRole('status')).toHaveText('1 / 1');
  await expect(bar.locator('.file-search-location')).toContainText('段');
  await page.keyboard.press('Escape');
  await expect(bar).toHaveCount(0);

  const largeWord = Buffer.from(
    zipSync({
      '[Content_Types].xml': strToU8(
        '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      ),
      '_rels/.rels': strToU8(
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      ),
      'word/document.xml': strToU8(
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
          Array.from(
            { length: 1201 },
            (_, index) =>
              `<w:p><w:r><w:t>${index === 1200 ? 'FAR_END_WORD_NEEDLE' : `Word paragraph ${index}`}</w:t></w:r></w:p>`,
          ).join('') +
          '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:body></w:document>',
      ),
    }),
  );
  await open('large-search.docx', largeWord);
  await expect(word.locator('[data-word-section]')).toHaveCount(7, { timeout: 20000 });
  await expect(word.locator('.word-search-block-1200')).toHaveCount(0);
  await page.keyboard.press('Control+f');
  await input.fill('FAR_END_WORD_NEEDLE');
  await expect(bar.getByRole('status')).toHaveText('1 / 1');
  await expect(word.locator('.word-search-block-1200')).toBeVisible({ timeout: 20000 });
  await expect(word.locator('.word-search-block-1200')).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(bar).toHaveCount(0);
  await expect(
    word.locator('body').evaluate(() => CSS.highlights.has('preview-find')),
  ).resolves.toBe(false);

  await open('search.html', Buffer.from('<h1>HTML needle</h1><p>Web needle</p>'));
  const html = page.frameLocator('iframe[title="HTML 网页预览"]');
  await expect(html.locator('h1')).toBeVisible();
  await html.locator('body').click();
  await page.keyboard.press('Control+f');
  await input.fill('needle');
  await expect(bar.getByRole('status')).toHaveText('1 / 2');

  await open(
    'search.csv',
    Buffer.from(
      'id,name\n' +
        Array.from(
          { length: 1000 },
          (_, i) => `${i},${i === 999 ? 'LastCellNeedle' : `Row ${i}`}`,
        ).join('\n'),
    ),
  );
  await expect(page.locator('.workbook-table')).toBeVisible();
  await page.keyboard.press('Control+f');
  await input.fill('LastCellNeedle');
  await expect(bar.getByRole('status')).toHaveText('1 / 1');
  await expect(page.locator('td[data-search-row="1000"]')).toContainText(['999', 'LastCellNeedle']);
  await expect(page.getByText('LastCellNeedle', { exact: true })).toBeInViewport();

  await open(
    'search.zip',
    Buffer.from(zipSync({ 'nested/needle.txt': strToU8('inside'), 'other.txt': strToU8('Other') })),
  );
  await expect(page.getByRole('textbox', { name: '筛选压缩包内容' })).toBeVisible();
  await page.keyboard.press('Control+f');
  await input.fill('needle');
  await expect(bar.getByRole('status')).toHaveText('1 / 1');
  await expect(page.getByRole('textbox', { name: '筛选压缩包内容' })).toHaveValue(
    'nested/needle.txt',
  );

  await open('search.pdf', pdfFixture());
  await expect(page.locator('.pdf-page')).toHaveCount(3, { timeout: 20000 });
  await page.keyboard.press('Control+f');
  await input.fill('OnlyOnPageThree');
  await expect(bar.getByRole('status')).toHaveText('1 / 1', { timeout: 20000 });
  await expect(bar.locator('.file-search-location')).toHaveText('第 3 页');
  await expect(page.locator('[data-pdf-page="3"]')).toBeInViewport();
  expect(await page.evaluate(() => window.findKeyResults.every(Boolean))).toBe(true);
  expect(errors).toEqual([]);
  console.log(
    'File search PASS: Ctrl/Command+F intercepted, text/MD/Word/HTML/PDF/virtual CSV/archive, navigation, Escape priority, outline border/clear.',
  );
} finally {
  await browser.close();
}
