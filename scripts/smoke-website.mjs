import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => errors.push(request.url()));
  // file:// 验证官网无需构建、服务器或网络即可使用。
  await page.goto(new URL('../website/index.html', import.meta.url).href);
  await expect(page).toHaveTitle(/SpacePreview/);
  await expect(page.locator('h1')).toContainText('不必打开');
  await expect(page.locator('#demo-content')).toContainText('留一点空间');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await expect(page.locator('.skip-link')).toHaveCSS('opacity', '1');
  const code = page.getByRole('button', { name: /hello.ts/ });
  await code.focus();
  await page.keyboard.press('Enter');
  await expect(code).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#demo-filename')).toHaveText('hello.ts');
  await expect(page.locator('#demo-content')).toContainText('const');
  await expect(page.locator('.demo-outline')).toBeHidden();
  await page.getByRole('button', { name: /项目归档.zip/ }).click();
  await expect(page.locator('#demo-content')).toContainText('budget.csv');
  await page.getByRole('button', { name: /灵感笔记.md/ }).click();
  await expect(page.locator('.demo-outline')).toBeVisible();
  await expect(page.locator('[aria-pressed="true"]')).toHaveCount(1);
  await page.getByText('这是在线文件预览工具吗？', { exact: true }).click();
  await expect(page.locator('details[open]')).toContainText('不会读取你的文件');
  for (const link of await page
    .locator('a[href^="#"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')))) {
    if (link !== '#') await expect(page.locator(link)).toHaveCount(1);
  }
  await expect(page.locator('a[href="https://linux.do/"]')).toHaveCount(3);
  await expect(page.locator('#download a.button')).toHaveCount(3);
  expect(
    await page
      .locator('img')
      .evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)),
  ).toBe(true);
  fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
  for (const width of [1440, 1024, 768, 760, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (width === 1440 || width === 390) {
      await page.screenshot({
        path: path.join(root, `test-results/website-${width}.png`),
        fullPage: true,
      });
    }
  }
  const noJs = await browser.newPage({ javaScriptEnabled: false });
  await noJs.goto(new URL('../website/index.html', import.meta.url).href);
  await expect(noJs.locator('#download')).toBeVisible();
  await expect(noJs.locator('#demo-content')).toContainText('留一点空间');
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
      const target = decodeURIComponent(link.split('#')[0]);
      expect(
        fs.existsSync(path.resolve(root, path.dirname(name), target)),
        `${name}: ${link}`,
      ).toBe(true);
    }
  }
  expect(errors).toEqual([]);
  console.log(
    'Website checks passed: local files, keyboard/demo controls, FAQ, assets, anchors, LinuxDo/download links, six viewport widths, no-JS content, Markdown local links.',
  );
} finally {
  await browser.close();
}
