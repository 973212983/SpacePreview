import { spawnSync } from 'node:child_process';

if (process.platform !== 'darwin') {
  console.error(
    'macOS 安装包必须在 Mac 上构建。请使用 Xcode Command Line Tools、Node.js 22.13+ 和 Rust。',
  );
  process.exit(1);
}

// Tauri automatically merges src-tauri/tauri.macos.conf.json on macOS.
const result = spawnSync(
  'npm',
  ['run', 'tauri', '--', 'build', '--target', 'universal-apple-darwin', '--bundles', 'app,dmg'],
  { stdio: 'inherit', env: process.env },
);
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
