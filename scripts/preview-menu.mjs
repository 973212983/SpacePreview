export async function openPreviewMenu(page) {
  const button = page.getByTitle('更多选项', { exact: true });
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
}

export async function closePreviewMenu(page) {
  if ((await page.getByTitle('更多选项', { exact: true }).getAttribute('aria-expanded')) === 'true')
    await page.getByLabel('关闭更多选项').click({ position: { x: 10, y: 100 } });
}
