import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import './reading-fixtures.mjs';
import { openPreviewMenu, closePreviewMenu } from './preview-menu.mjs';

// The same interactions run against Edge or the owned desktop WebView2 page.
const native = process.env.TYPOGRAPHY_CDP;
const browser = native
  ? await chromium.connectOverCDP(native)
  : await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = native
    ? browser
        .contexts()[0]
        .pages()
        .find((page) => /tauri\.localhost/.test(page.url()))
    : await browser.newPage({ viewport: { width: 1000, height: 760 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  if (!native) {
    const csp = JSON.parse(await readFile('src-tauri/tauri.conf.json', 'utf8')).app.security.csp;
    await page.route('**/', async (route) => {
      if (route.request().resourceType() !== 'document') return route.continue();
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: { ...response.headers(), 'content-security-policy': csp },
      });
    });
    await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1423');
  }
  const open = async (name, content) => {
    await closePreviewMenu(page);
    await page
      .locator('input[type=file]')
      .setInputFiles(
        content === undefined
          ? resolve('test-results/fixtures', name)
          : { name, mimeType: 'application/octet-stream', buffer: Buffer.from(content) },
      );
    await expect(page.locator('.file-title strong')).toHaveText(name);
  };
  const appearance = async (size, font) => {
    await openPreviewMenu(page);
    await expect(page.getByLabel('阅读字号')).toHaveCount(1);
    await expect(page.getByLabel('阅读字号')).toHaveValue(String(size));
    if (font) await page.getByLabel('阅读字体').selectOption(font);
    await closePreviewMenu(page);
  };
  const wheel = async (target, deltaY, ctrlKey = true) => {
    expect(
      await target.evaluate(
        (element, { deltaY, ctrlKey }) =>
          element.dispatchEvent(
            new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY, ctrlKey }),
          ),
        { deltaY, ctrlKey },
      ),
    ).toBe(!ctrlKey);
  };
  await open('license.dat');
  const text = page.locator('.preview-layer:visible .code-scroll pre');
  const adjustment = page.locator('.preview-adjustment');
  await expect(text).toHaveCSS('font-size', '16px');
  await page.keyboard.press('Control+=');
  await expect(text).toHaveCSS('font-size', '18px');
  await expect(adjustment).toHaveText('字号18 px');
  await expect(adjustment).toHaveCSS('pointer-events', 'none');
  await wheel(text, -120);
  await expect(adjustment).toHaveText('字号20 px');
  await page.waitForTimeout(1100);
  await wheel(text, 120);
  await expect(adjustment).toHaveText('字号18 px');
  await page.waitForTimeout(1100);
  await expect(adjustment).toBeVisible();
  await page.screenshot({ path: 'test-results/typography-size-indicator.png' });
  await expect(adjustment).toHaveCount(0, { timeout: 2500 });
  await wheel(text, 120, false);
  await expect(adjustment).toHaveCount(0);
  await appearance(18, 'serif');
  await expect(text).toHaveCSS('font-family', /Georgia/);
  await page.keyboard.press('Control+-');
  await wheel(text, -120);
  await expect(text).toHaveCSS('font-size', '18px');
  await wheel(text, 120, false);
  await expect(text).toHaveCSS('font-size', '18px');
  await text.hover();
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -120);
  await page.keyboard.up('Control');
  await expect(text).toHaveCSS('font-size', '20px');
  await page.keyboard.press('Control+-');
  await page.keyboard.press('Meta+-');
  await expect(text).toHaveCSS('font-size', '16px');
  await appearance(16, 'mono');
  await expect(text).toHaveCSS('font-family', /JetBrains Mono/);
  for (let i = 0; i < 15; i++) await page.keyboard.press('Control+=');
  await expect(text).toHaveCSS('font-size', '40px');
  await expect(adjustment).toHaveText('字号40 px');
  for (let i = 0; i < 20; i++) await page.keyboard.press('Control+-');
  await expect(text).toHaveCSS('font-size', '10px');
  await expect(adjustment).toHaveText('字号10 px');
  await expect(page.locator('.titlebar')).toHaveCSS('height', '36px');

  await open('editor.ts');
  await expect(adjustment).toHaveCount(0);
  await expect(text).toHaveCSS('font-size', '16px');
  await expect(text).toHaveCSS('font-family', /JetBrains Mono/);
  await appearance(16, 'sans');
  await expect(text).toHaveCSS('font-family', /Segoe UI/);
  await page.keyboard.press('Control+=');
  await expect(text).toHaveCSS('font-size', '18px');

  await open('阅读体验.md');
  const prose = page.locator('.preview-layer:visible .prose');
  await expect(prose).toHaveCSS('font-size', '16px');
  await appearance(16, 'serif');
  await page.keyboard.press('Control+=');
  await expect(prose).toHaveCSS('font-size', '18px');
  await expect(prose).toHaveCSS('font-family', /Georgia/);
  await openPreviewMenu(page);
  await page.getByRole('button', { name: '纯文本预览', exact: true }).click();
  await expect(text).toHaveCSS('font-size', '18px');
  await appearance(18);

  for (const name of ['阅读时光.fb2', '阅读时光.epub', '分析笔记.ipynb', '阅读笔记.odt']) {
    await open(name);
    await expect(prose).toHaveCSS('font-size', '16px');
    await page.keyboard.press('Control+=');
    await expect(prose).toHaveCSS('font-size', '18px');
    await appearance(18, 'serif');
    await expect(prose).toHaveCSS('font-family', /Georgia/);
  }

  await open('安全阅读.html');
  await expect(text).toHaveCSS('font-size', '16px');
  await page.keyboard.press('Control+=');
  await openPreviewMenu(page);
  await page.getByLabel('HTML 视图').selectOption('web');
  await closePreviewMenu(page);
  const html = page.frameLocator('iframe[title="HTML 网页预览"]');
  await expect(html.locator('body')).toHaveCSS('zoom', '1.125');
  await appearance(18, 'mono');
  await expect(html.locator('p').first()).toHaveCSS('font-family', /JetBrains Mono/);
  await html.locator('h1').click();
  await page.keyboard.press('Control+=');
  await expect(html.locator('body')).toHaveCSS('zoom', '1.25');
  await wheel(html.locator('body'), 120);
  await expect(html.locator('body')).toHaveCSS('zoom', '1.125');
  await expect(adjustment).toHaveText('字号18 px');
  await appearance(18);
  await openPreviewMenu(page);
  await page.getByRole('button', { name: '阅读模式', exact: true }).click();
  await closePreviewMenu(page);
  await expect(prose).toHaveCSS('font-size', '18px');
  await page.keyboard.press('Control+=');
  await expect(prose).toHaveCSS('font-size', '20px');

  for (const [name, title] of [
    ['样式文档.docx', 'Word 原样预览'],
    ['rich.rtf', 'RTF 富文本预览'],
  ]) {
    await open(name);
    const frame = page.frameLocator(`iframe[title="${title}"]`);
    const section = frame.locator('section.docx').first();
    await expect(section).toBeVisible({ timeout: 20000 });
    if (name.endsWith('.docx')) {
      await frame.locator('span').first().click();
      await page.keyboard.press('Shift+Space');
      await expect(prose).toContainText('保持文档原有的表达');
      await expect(page.locator('iframe[title="Word 原样预览"]')).toHaveCount(0);
      await page.keyboard.press('Shift+Space');
      await expect(section).toBeVisible({ timeout: 20000 });
    }
    const span = frame.locator('span').first();
    const original = await span.evaluate((element) => ({
      size: getComputedStyle(element).fontSize,
      font: getComputedStyle(element).fontFamily,
    }));
    const before = Number(await section.evaluate((element) => element.style.zoom));
    await span.click();
    await page.keyboard.press('Control+=');
    await expect
      .poll(() => section.evaluate((element) => Number(element.style.zoom)))
      .toBe(Number((before + 0.1).toFixed(2)));
    await wheel(section, -120);
    await expect
      .poll(() => section.evaluate((element) => Number(element.style.zoom)))
      .toBe(Number((before + 0.2).toFixed(2)));
    expect(
      await span.evaluate((element) => ({
        size: getComputedStyle(element).fontSize,
        font: getComputedStyle(element).fontFamily,
      })),
    ).toEqual(original);
    await expect(adjustment).toHaveText(
      `缩放${Math.round(Number((before + 0.2).toFixed(2)) * 100)}%`,
    );
    await openPreviewMenu(page);
    await expect(page.getByLabel('阅读字号')).toHaveCount(0);
    await expect(page.getByLabel('Word 缩放')).toHaveValue(
      String(Number((before + 0.2).toFixed(2))),
    );
    await page.getByRole('button', { name: '文字速览', exact: true }).click();
    await expect(page.getByLabel('阅读字号')).toHaveValue('16');
    await closePreviewMenu(page);
    await page.keyboard.press('Control+=');
    await appearance(18);
  }

  await open('smoke.pdf');
  const pdf = page.locator('.pdf-page').first();
  await expect(pdf.locator('canvas')).toBeVisible({ timeout: 20000 });
  const width = await pdf.evaluate((element) => element.getBoundingClientRect().width);
  await page.keyboard.press('Control+=');
  await expect
    .poll(() => pdf.evaluate((element) => element.getBoundingClientRect().width))
    .toBeGreaterThan(width);
  await expect(adjustment).toHaveText('缩放110%');
  await wheel(pdf, 120);
  await expect
    .poll(() => pdf.evaluate((element) => element.getBoundingClientRect().width))
    .toBeCloseTo(width, 0);

  await open(
    'many.csv',
    '编号,正文\n' + Array.from({ length: 5000 }, (_, i) => `${i + 1},记录${i + 1}`).join('\n'),
  );
  const table = page.locator('.workbook-table');
  const scroll = page.locator('.workbook-scroll');
  await expect(table).toHaveCSS('font-size', '16px');
  await scroll.evaluate((element) => {
    element.scrollTop = 3200 * 32;
  });
  await expect(table).toContainText('记录3201');
  await page.keyboard.press('Control+=');
  await expect(table).toHaveCSS('font-size', '18px');
  await expect(table).toContainText('记录3201');
  await scroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(table).toContainText('记录5000');
  await page.keyboard.press('Control+-');
  await expect(table).toContainText('记录5000');

  await open('sample.sqlite');
  await page.getByRole('button', { name: /^中文表/ }).click();
  await expect(page.locator('.database-grid')).toHaveCSS('font-size', '16px');
  await page.keyboard.press('Control+=');
  await expect(page.locator('.database-grid')).toHaveCSS('font-size', '18px');
  await appearance(18, 'mono');
  await expect(page.locator('.database-grid')).toHaveCSS('font-family', /JetBrains Mono/);

  await open(
    'plain.eml',
    'From: a@example.com\r\nSubject: Plain mail\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nPlain body',
  );
  await expect(page.locator('.mail-text')).toHaveCSS('font-size', '16px');
  await page.keyboard.press('Control+=');
  await expect(page.locator('.mail-text')).toHaveCSS('font-size', '18px');
  await open(
    'html.eml',
    'From: a@example.com\r\nSubject: HTML mail\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<p>HTML body</p>',
  );
  await expect(html.locator('body')).toContainText('HTML body');
  await page.keyboard.press('Control+=');
  await appearance(18);
  await expect(html.locator('body')).toHaveCSS('zoom', '1.125');

  await open(
    'attachment.eml',
    [
      'From: a@example.com',
      'Subject: Attachment',
      'Content-Type: multipart/mixed; boundary="parts"',
      '',
      '--parts',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Parent body',
      '--parts',
      'Content-Type: text/plain',
      'Content-Disposition: attachment; filename="child.txt"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from('Attachment body').toString('base64'),
      '--parts--',
    ].join('\r\n'),
  );
  await expect(page.locator('.mail-text')).toContainText('Parent body');
  await page.keyboard.press('Control+=');
  await appearance(18);
  await page.getByTitle('预览附件').click();
  await expect(text).toHaveCSS('font-size', '16px');
  await page.keyboard.press('Control+=');
  await appearance(18);
  await page.locator('.archive-back-button').click();
  await expect(page.locator('.preview-layer:visible .mail-text')).toHaveCSS('font-size', '18px');
  await page.keyboard.press('Control+=');
  await expect(page.locator('.preview-layer:visible .mail-text')).toHaveCSS('font-size', '20px');
  await appearance(20);

  const archive = zipSync({
    'parent.md': strToU8('# Parent\n\nOuter text'),
    'child.txt': strToU8('Inner text'),
  });
  await open('typography.zip', archive);
  await page.locator('.archive-row').filter({ hasText: 'parent.md' }).dblclick();
  await expect(prose).toContainText('Outer text');
  await page.keyboard.press('Control+=');
  await appearance(18);
  await page.locator('.archive-back-button').click();
  await page.locator('.archive-row').filter({ hasText: 'child.txt' }).dblclick();
  await expect(text).toHaveCSS('font-size', '16px');
  await page.keyboard.press('Control+=');
  await appearance(18);
  await page.locator('.archive-back-button').click();
  await expect(page.locator('.dropdown select')).toHaveCount(0);

  await open('license.dat');
  await openPreviewMenu(page);
  await page.getByRole('button', { name: '偏好设置', exact: true }).click();
  await expect(page.locator('.settings-dialog')).toContainText('文字默认 16px');
  expect(
    await page
      .locator('.settings-dialog')
      .evaluate((element) => element.scrollHeight <= element.clientHeight + 1),
  ).toBe(true);
  await page.keyboard.press('Control+=');
  await page.keyboard.press('Escape');
  await expect(text).toHaveCSS('font-size', '16px');
  await page.screenshot({ path: 'test-results/typography-controls.png' });
  expect(errors).toEqual([]);
  console.log(
    'Typography PASS: defaults, fonts, Ctrl/Command/iframe/wheel, bounds, mode retention, document page zoom, deep tables, mail, archive and preferences.',
  );
} finally {
  await browser.close();
}
