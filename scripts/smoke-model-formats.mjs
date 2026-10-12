import { chromium, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { openPreviewMenu, closePreviewMenu } from './preview-menu.mjs';
await writeFile(
  new URL('../test-results/fixtures/sample.pcd', import.meta.url),
  [
    '# .PCD v0.7',
    'VERSION 0.7',
    'FIELDS x y z',
    'SIZE 4 4 4',
    'TYPE F F F',
    'COUNT 1 1 1',
    'WIDTH 4',
    'HEIGHT 1',
    'VIEWPOINT 0 0 0 1 0 0 0',
    'POINTS 4',
    'DATA ascii',
    '0 0 0',
    '1 0 0',
    '0 1 0',
    '0 0 1',
    '',
  ].join('\n'),
);
const geometry = Buffer.alloc(44);
[0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, i) => geometry.writeFloatLE(value, i * 4));
[0, 1, 2].forEach((value, i) => geometry.writeUInt16LE(value, 36 + i * 2));
const model = {
  asset: { version: '2.0' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
  buffers: [{ byteLength: 44 }],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: 36 },
    { buffer: 0, byteOffset: 36, byteLength: 6 },
  ],
  accessors: [
    { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
    { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
  ],
};
await writeFile(
  new URL('../test-results/fixtures/sample.gltf', import.meta.url),
  JSON.stringify({
    ...model,
    buffers: [
      {
        byteLength: 44,
        uri: `data:application/octet-stream;base64,${geometry.toString('base64')}`,
      },
    ],
  }),
);
const jsonText = JSON.stringify(model),
  json = Buffer.from(jsonText.padEnd(Math.ceil(jsonText.length / 4) * 4, ' '));
const glb = Buffer.alloc(12 + 8 + json.length + 8 + geometry.length);
glb.writeUInt32LE(0x46546c67, 0);
glb.writeUInt32LE(2, 4);
glb.writeUInt32LE(glb.length, 8);
glb.writeUInt32LE(json.length, 12);
glb.writeUInt32LE(0x4e4f534a, 16);
json.copy(glb, 20);
glb.writeUInt32LE(geometry.length, 20 + json.length);
glb.writeUInt32LE(0x004e4942, 24 + json.length);
geometry.copy(glb, 28 + json.length);
await writeFile(new URL('../test-results/fixtures/sample.glb', import.meta.url), glb);
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
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
  for (const ext of [
    '3ds',
    'fbx',
    'ply',
    '3mf',
    'blend',
    'dae',
    'pcd',
    'glb',
    'gltf',
    'step',
    'brep',
    'iges',
  ]) {
    await page
      .locator('input[type=file]')
      .setInputFiles(
        fileURLToPath(new URL(`../test-results/fixtures/sample.${ext}`, import.meta.url)),
      );
    await expect(page.locator('.file-title strong')).toHaveText(`sample.${ext}`);
    await expect(page.locator('.model-loading')).toHaveCount(0, { timeout: 120000 });
    await expect(page.locator('.model-canvas canvas')).toBeVisible();
    await openPreviewMenu(page);
    await expect(page.locator('.dropdown .content-toolbar')).not.toContainText('· 0');
    await closePreviewMenu(page);
    const canvas = page.locator('.model-canvas canvas');
    const before = await canvas.screenshot();
    const rect = await canvas.boundingBox();
    await page.mouse.move(rect.x + rect.width * 0.4, rect.y + rect.height * 0.4);
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.width * 0.6, rect.y + rect.height * 0.7, { steps: 8 });
    await page.mouse.up();
    expect((await canvas.screenshot()).equals(before)).toBe(false);
    console.log('model', ext, 'PASS');
  }
  await page.screenshot({ path: 'test-results/formats-step.png' });
  expect(errors).toEqual([]);
} finally {
  await browser.close();
}
