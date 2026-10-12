import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const endpoint = 'http://127.0.0.1:1431';
const child = spawn(resolve('src-tauri/target/release/space-preview.exe'), [], {
  windowsHide: true,
  stdio: 'ignore',
  env: {
    ...process.env,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:
      '--remote-debugging-port=1431 --remote-debugging-address=127.0.0.1',
  },
});
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Owned desktop app exited: ${child.exitCode}`);
    try {
      const response = await fetch(`${endpoint}/json/version`);
      if (!response.ok) throw new Error('not ready');
      break;
    } catch {
      if (attempt === 99) throw new Error('Owned WebView2 did not start.');
      await delay(100);
    }
  }
  process.env.TYPOGRAPHY_CDP = endpoint;
  await import('./smoke-typography.mjs');
  console.log('Native WebView2 typography PASS.');
} finally {
  if (child.exitCode === null) child.kill();
}
