import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';

// Pass private documents as local paths; never copy their content into fixtures or logs.
const paths = process.argv.slice(2);
if (!paths.length) throw new Error('Pass local DOCX paths to verify.');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1423');
  for (let index = 0; index < paths.length; index++) {
    const before = fs.readFileSync(paths[index]);
    await page.locator('input[type=file]').setInputFiles(paths[index]);
    const buttons = page.locator('.reading-outline nav button');
    await expect(buttons.first()).toBeVisible({ timeout: 30000 });
    const count = await buttons.count();
    expect(count).toBeGreaterThan(1);
    await expect(buttons.first()).toHaveCSS('font-size', '12px');
    expect(
      await page
        .locator('.reading-outline nav')
        .evaluate((nav) => getComputedStyle(nav, '::-webkit-scrollbar').width),
    ).toBe('3px');
    expect(
      await page
        .locator('.reading-outline nav')
        .evaluate((nav) => nav.offsetWidth - nav.clientWidth),
    ).toBe(3);
    const word = page.frameLocator('iframe[title="Word 原样预览"]');
    await expect(word.locator('[class*="word-heading-"]')).toHaveCount(count);
    const middleIndex = Math.floor(count / 2);
    const middle = word.locator(`.word-heading-${middleIndex}`);
    await buttons.nth(middleIndex).click();
    await expect(buttons.nth(middleIndex)).toHaveAttribute('aria-current', 'location');
    await expect
      .poll(() => middle.evaluate((element) => Math.abs(element.getBoundingClientRect().top)))
      .toBeLessThan(100);
    await buttons.first().click();
    await expect(buttons.first()).toHaveAttribute('aria-current', 'location');
    await middle.evaluate((element) => element.scrollIntoView({ block: 'start' }));
    await expect(buttons.nth(middleIndex)).toHaveAttribute('aria-current', 'location');
    await buttons.last().click();
    await expect(word.locator(`.word-heading-${count - 1}`)).toBeInViewport();
    expect(fs.readFileSync(paths[index]).equals(before)).toBe(true);
    console.log(
      `Document ${index + 1}: ${count} outline entries; navigation, scroll tracking, 12px font, 3px scrollbar and unchanged source passed.`,
    );
  }
  expect(errors).toEqual([]);
} finally {
  await browser.close();
}
