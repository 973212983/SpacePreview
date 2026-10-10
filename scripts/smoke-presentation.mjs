import fs from 'node:fs';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { openPreviewMenu, closePreviewMenu } from './preview-menu.mjs';

const [source, rendered] = process.argv.slice(2);
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:1423';
if (!source || !rendered) throw new Error('Provide a local PPTX and its converted PDF.');
const original = fs.readFileSync(source);
const pdfBytes = fs.readFileSync(rendered);
const loading = getDocument({ data: Uint8Array.from(pdfBytes) });
const pdf = await loading.promise;
const count = pdf.numPages;
const info = {
  id: source,
  path: source,
  name: path.basename(source),
  size: original.length,
  modified: 1,
  mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  // Exercise the React view with only the native IPC transport mocked.
  for (const failure of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 740 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/native-source', (route) => route.fulfill({ body: original }));
    await page.route('**/native-preview.pdf', (route) =>
      route.fulfill({ body: pdfBytes, contentType: 'application/pdf' }),
    );
    await page.addInitScript(
      ({ source, failure, size }) => {
        let id = 0;
        window.isTauri = true;
        window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
        window.__TAURI_INTERNALS__ = {
          metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
          transformCallback() {
            return ++id;
          },
          unregisterCallback() {},
          convertFileSrc() {
            return '/native-preview.pdf';
          },
          async invoke(cmd, args) {
            if (cmd === 'plugin:event|listen') return ++id;
            if (cmd === 'initial_paths') return { paths: [source.path], text: false };
            if (cmd === 'inspect_file') return source;
            if (cmd === 'list_siblings') return [source];
            if (cmd === 'agent_status') return { supported: true, enabled: true, running: true };
            if (cmd === 'file_icon') return new ArrayBuffer(0);
            if (cmd === 'read_prefix')
              return (await (await fetch('/native-source')).arrayBuffer()).slice(0, args.limit);
            if (cmd === 'render_presentation') {
              await new Promise((resolve) => setTimeout(resolve, 150));
              if (failure) throw 'PowerPoint unavailable; text fallback';
              return {
                id: 'rendered',
                path: 'rendered.pdf',
                name: 'rendered.pdf',
                size,
                modified: 1,
                mime: 'application/pdf',
              };
            }
            return false;
          },
        };
      },
      { source: info, failure, size: pdfBytes.length },
    );
    await page.goto(`${base}/`);
    if (!failure) {
      const pages = page.locator('.pdf-page');
      await expect(pages).toHaveCount(count, { timeout: 30000 });
      await expect(pages.first()).toHaveAttribute('data-rendered', 'true', { timeout: 30000 });
      const box = await pages.first().boundingBox();
      expect(box.width).toBeLessThanOrEqual(952);
      expect(box.height).toBeLessThanOrEqual(656);
      for (const number of [...new Set([2, count])]) {
        await pages
          .nth(number - 1)
          .evaluate((element) => element.scrollIntoView({ block: 'start' }));
        await expect(pages.nth(number - 1)).toHaveAttribute('data-rendered', 'true', {
          timeout: 30000,
        });
        expect(
          await pages
            .nth(number - 1)
            .locator('canvas')
            .evaluate((canvas) => {
              const pixels = canvas
                .getContext('2d')
                .getImageData(0, 0, canvas.width, canvas.height).data;
              let colored = 0;
              for (let i = 0; i < pixels.length; i += 64)
                if (
                  Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) -
                    Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) >
                  30
                )
                  colored++;
              return colored;
            }),
        ).toBeGreaterThan(100);
      }
      await pages.first().evaluate((element) => element.scrollIntoView({ block: 'start' }));
      await expect(pages.first().locator('.pdf-text-layer')).toContainText('CREATE');
      await openPreviewMenu(page);
      await page.getByLabel('幻灯片视图').selectOption('text');
      await expect(page.locator('.slide-paper')).toContainText('CREATE TABLE');
      await expect(page.locator('.slide-paper h1')).toHaveCSS('white-space', 'pre-wrap');
      await page.getByTitle('下一张幻灯片').click();
      await expect(page.locator('.slide-paper')).toContainText('无文字内容');
      await page.getByLabel('幻灯片视图').selectOption('pages');
      await closePreviewMenu(page);
      await expect(pages).toHaveCount(count);
      await page.setViewportSize({ width: 640, height: 480 });
      await expect
        .poll(async () => (await pages.first().boundingBox()).width)
        .toBeLessThanOrEqual(592);
      expect((await page.locator('.titlebar').boundingBox()).height).toBe(36);
    } else {
      await expect(page.locator('.slide-paper')).toContainText('CREATE TABLE', { timeout: 30000 });
      await openPreviewMenu(page);
      await expect(page.getByRole('status')).toContainText('PowerPoint unavailable');
      await expect(page.getByLabel('幻灯片视图').locator('option[value=pages]')).toHaveAttribute('disabled', '');
    }
    expect(errors).toEqual([]);
    await page.close();
  }
  expect(fs.readFileSync(source).equals(original)).toBe(true);
  console.log(
    `Presentation: ${count} pages, image slides, selectable text layer, fit, mode switching and failure fallback passed; source unchanged.`,
  );
} finally {
  await loading.destroy();
  await browser.close();
}
