import { chromium, expect } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { openPreviewMenu } from './preview-menu.mjs';

// Only the two SpacePreview values are snapshotted and restored. Other startup
// applications and the user's existing autostart preference are untouched.
const powershell = (code) =>
  execFileSync(
    'pwsh',
    [
      '-NoProfile',
      '-Command',
      `[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false); $OutputEncoding = [Console]::OutputEncoding;\n${code}`,
    ],
    { encoding: 'utf8', windowsHide: true },
  );
const snapshot = JSON.parse(
  powershell(`
$records = foreach ($path in @('SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run','SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run')) {
  $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($path)
  try {
    $present = $null -ne $key -and (@($key.GetValueNames()) -contains 'SpacePreview')
    [pscustomobject]@{ path=$path; present=$present; value=if($present){$key.GetValue('SpacePreview',$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)}else{$null}; kind=if($present){$key.GetValueKind('SpacePreview').ToString()}else{$null} }
  } finally { if($null -ne $key){$key.Dispose()} }
}
ConvertTo-Json -InputObject @($records) -Depth 4 -Compress
`),
);
const runValue = () =>
  powershell(`
$key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run')
try { ConvertTo-Json -InputObject $key.GetValue('SpacePreview',$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames) -Compress } finally { $key.Dispose() }
`).trim();
const directory = resolve('test-results/Autostart install path');
await mkdir(directory, { recursive: true });
const executable = resolve(directory, 'SpacePreview.exe');
await copyFile(resolve('src-tauri/target/release/space-preview.exe'), executable);
const endpoint = 'http://127.0.0.1:1432';
const launch = (args) =>
  spawn(executable, args, {
    windowsHide: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:
        '--remote-debugging-port=1432 --remote-debugging-address=127.0.0.1',
    },
  });
const child = launch(['--autostart']);
let browser;
try {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`Owned startup app exited: ${child.exitCode}`);
    try {
      if (!(await fetch(`${endpoint}/json/version`)).ok) throw new Error('not ready');
      break;
    } catch {
      if (i === 99) throw new Error('Owned WebView2 did not start');
      await delay(100);
    }
  }
  browser = await chromium.connectOverCDP(endpoint);
  let page;
  for (let i = 0; i < 100; i++) {
    page = browser
      .contexts()[0]
      .pages()
      .find((page) => /tauri\.localhost/.test(page.url()));
    if (page) break;
    await delay(100);
  }
  if (!page) throw new Error('Owned preview page was not found');
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await expect(page.locator('input[type=file]')).toBeAttached();
  const visible = () =>
    page.evaluate(() =>
      window.__TAURI_INTERNALS__.invoke('plugin:window|is_visible', { label: 'main' }),
    );
  const secondary = async (args) => {
    const process = launch(args);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        process.kill();
        reject(new Error('Second instance did not exit'));
      }, 10000);
      process.once('exit', (code) => {
        clearTimeout(timer);
        code === 0 ? resolve() : reject(new Error(`Second instance exit: ${code}`));
      });
      process.once('error', reject);
    });
  };
  expect(await visible()).toBe(false);
  await secondary(['--autostart']);
  expect(await visible()).toBe(false);
  await secondary([]);
  await expect.poll(visible).toBe(true);
  console.log(
    'Startup mode PASS: login hidden, duplicate login stays hidden, manual launch shows window.',
  );
  const settings = async () => {
    await openPreviewMenu(page);
    await page.getByRole('button', { name: '偏好设置', exact: true }).click();
  };
  await settings();
  const toggle = page.getByRole('switch', { name: '开机自启动', exact: true });
  await expect(toggle).toBeEnabled();
  expect(
    await page
      .locator('.settings-dialog')
      .evaluate((element) => element.scrollHeight <= element.clientHeight + 1),
  ).toBe(true);
  if ((await toggle.getAttribute('aria-checked')) === 'true') {
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
  }
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  expect(JSON.parse(runValue())).toBe(`"${executable}" --autostart`);
  await page.reload();
  await expect(page.locator('input[type=file]')).toBeAttached();
  await settings();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  expect(JSON.parse(runValue())).toBeNull();
  await page.screenshot({ path: 'test-results/autostart-native-settings.png' });
  await page.getByRole('button', { name: '关闭设置', exact: true }).click();
  await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('hide_preview'));
  await expect.poll(visible).toBe(false);
  await secondary(['--autostart', resolve('src-tauri/Cargo.toml')]);
  await expect.poll(visible).toBe(true);
  await expect(page.locator('.file-title strong')).toHaveText('Cargo.toml');
  await expect(page.locator('.code-scroll')).toContainText('auto-launch');
  expect(errors).toEqual([]);
  console.log(
    'Autostart PASS: enable/disable actual HKCU entry, quoted path with spaces, reload persistence, explicit file opens normally.',
  );
} finally {
  if (browser) await browser.close();
  if (child.exitCode === null) child.kill();
  const encoded = Buffer.from(JSON.stringify(snapshot), 'utf8').toString('base64');
  powershell(`
$records = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')) | ConvertFrom-Json
foreach ($record in $records) {
  $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($record.path,$true)
  try {
    if($record.present) {
      $kind = [Enum]::Parse([Microsoft.Win32.RegistryValueKind], $record.kind)
      if($record.kind -eq 'Binary') {
        $key.SetValue('SpacePreview',[byte[]]$record.value,$kind)
      } else {
        $key.SetValue('SpacePreview',$record.value,$kind)
      }
    } elseif($null -ne $key) { $key.DeleteValue('SpacePreview',$false) }
  } finally { if($null -ne $key){$key.Dispose()} }
}
`);
  console.log('Original SpacePreview startup values restored.');
}
