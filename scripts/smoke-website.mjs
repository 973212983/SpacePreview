import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const websiteUrl = new URL('../website/index.html', import.meta.url).href;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => errors.push(request.url()));
  // 官网应可直接离线打开，截图不依赖帖子原目录和外部服务。
  await page.goto(websiteUrl);
  await expect(page).toHaveTitle(/SpacePreview/);
  await expect(page.locator('h1')).toContainText('不必打开');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await expect(page.locator('.skip-link')).toHaveCSS('opacity', '1');

  const loadedImages = async () => {
    await page.waitForFunction(() =>
      [...document.querySelectorAll('img[src]')].every(
        (image) => image.complete && image.naturalWidth > 0,
      ),
    );
  };
  await loadedImages();
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(7);
  for (let index = 0; index < 7; index++) {
    await tabs.nth(index).click();
    await expect(tabs.nth(index)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveCount(1);
    await expect(page.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      await tabs.nth(index).getAttribute('id'),
    );
    await loadedImages();
    await expect(page.locator('#preview-image')).not.toHaveAttribute('alt', '');
    await page.locator('.screenshot-open').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('#dialog-image')).toHaveAttribute(
      'src',
      await page.locator('#preview-image').evaluate((image) => image.src),
    );
    await loadedImages();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  }
  await tabs.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: '代码高亮' })).toBeFocused();
  await expect(page.getByRole('tab', { name: '代码高亮' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.keyboard.press('End');
  await expect(tabs.last()).toBeFocused();
  await page.keyboard.press('Home');
  await expect(tabs.first()).toBeFocused();
  await page.locator('.screenshot-open').click();
  await page.getByRole('button', { name: '关闭大图' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.locator('.screenshot-open').click();
  await page.mouse.click(2, 2);
  await expect(page.getByRole('dialog')).not.toBeVisible();

  await page.locator('.all-formats summary').click();
  expect(await page.locator('.format-table tbody tr').count()).toBeGreaterThan(30);
  await expect(page.locator('.format-table thead th')).toHaveCount(2);
  expect(
    await page
      .locator('.format-table tbody tr')
      .evaluateAll((rows) => rows.every((row) => row.children.length === 2)),
  ).toBe(true);
  await expect(page.locator('.format-table')).toContainText('ZIP');
  await page.locator('.all-formats summary').click();
  await page.getByText('三个系统都支持空格唤起吗？', { exact: true }).click();
  await expect(page.locator('.faq-list details[open]')).toContainText('Linux');
  await page.getByText('三个系统都支持空格唤起吗？', { exact: true }).click();
  for (const link of await page
    .locator('a[href^="#"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')))) {
    if (link !== '#') await expect(page.locator(link)).toHaveCount(1);
  }
  expect(fs.readFileSync(path.join(root, 'website/index.html'), 'utf8')).not.toMatch(
    /linux\.do|linuxdo/i,
  );
  await expect(page.locator('#download a.button')).toHaveCount(4);
  await loadedImages();
  fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
  for (const width of [1440, 1024, 768, 760, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.locator('.all-formats summary').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.locator('.all-formats summary').click();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    if (width === 1440 || width === 390) {
      await page.screenshot({
        path: path.join(root, `test-results/website-${width}.png`),
        fullPage: true,
      });
    }
  }
  const noJs = await browser.newPage({ javaScriptEnabled: false });
  await noJs.goto(websiteUrl);
  await expect(noJs.locator('#download')).toBeVisible();
  await expect(noJs.locator('#preview-image')).toBeVisible();
  await expect(noJs.locator('.screenshot-open')).toHaveAttribute(
    'href',
    'assets/preview-archive.png',
  );
  await noJs.close();
  for (const name of [
    'README.md',
    'website/README.md',
    'docs/HISTORY.md',
    'docs/PREVIEW-GUIDE.md',
  ]) {
    const source = fs.readFileSync(path.join(root, name), 'utf8');
    expect(source.charCodeAt(0)).not.toBe(0xfeff);
    for (const [, link] of source.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^(https?:|#)/.test(link)) continue;
      expect(
        fs.existsSync(
          path.resolve(root, path.dirname(name), decodeURIComponent(link.split('#')[0])),
        ),
        `${name}: ${link}`,
      ).toBe(true);
    }
  }
  expect(errors).toEqual([]);
  console.log(
    'Website checks passed: seven real screenshots, image loading, tab keyboard navigation, zoom/close/Escape/backdrop, two-column format table, FAQ, no LinuxDo links, downloads, six responsive widths, offline/no-JS content, Markdown links.',
  );
} finally {
  await browser.close();
}
