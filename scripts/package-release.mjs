import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { updateAssetName } from './updater-manifest.mjs';

const [target, platform] = process.argv.slice(2);
const targets = {
  'windows-x64': 'x86_64-pc-windows-msvc',
  'macos-x64': 'x86_64-apple-darwin',
  'macos-arm64': 'aarch64-apple-darwin',
  'linux-x64': 'x86_64-unknown-linux-gnu',
};
if (!targets[platform] || targets[platform] !== target)
  throw new Error('Unsupported release target.');
const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
const built = path.resolve('src-tauri', 'target', target, 'release');
const destination = path.resolve('release-assets');
fs.mkdirSync(destination, { recursive: true });
const windows = platform === 'windows-x64';
const linux = platform === 'linux-x64';
if (windows) {
  const binary = fs.readFileSync(path.join(built, 'space-preview.exe'));
  const pe = binary.readUInt32LE(0x3c);
  if (binary.toString('ascii', pe, pe + 4) !== 'PE\0\0' || binary.readUInt16LE(pe + 4) !== 0x8664) {
    throw new Error('Expected a Windows x64 executable.');
  }
} else if (linux) {
  const binary = fs.readFileSync(path.join(built, 'space-preview'));
  if (
    binary.toString('hex', 0, 4) !== '7f454c46' ||
    binary[4] !== 2 ||
    binary[5] !== 1 ||
    binary.readUInt16LE(18) !== 62
  )
    throw new Error('Expected a Linux x64 executable.');
  const debDirectory = path.join(built, 'bundle', 'deb');
  const debs = fs.readdirSync(debDirectory).filter((name) => name.endsWith('.deb'));
  if (debs.length !== 1) throw new Error(`Expected one .deb installer, got ${debs.length}.`);
  const deb = path.join(debDirectory, debs[0]);
  const arch = execFileSync('dpkg-deb', ['--field', deb, 'Architecture'], {
    encoding: 'utf8',
  }).trim();
  if (arch !== 'amd64') throw new Error(`Wrong Linux package architecture: ${arch}`);
  fs.copyFileSync(deb, path.join(destination, `SpacePreview-${version}-${platform}.deb`));
} else {
  const app = path.join(built, 'bundle', 'macos', 'SpacePreview.app');
  const binary = path.join(app, 'Contents', 'MacOS', 'space-preview');
  const arch = execFileSync('lipo', ['-archs', binary], { encoding: 'utf8' }).trim();
  if (arch !== (platform === 'macos-x64' ? 'x86_64' : 'arm64'))
    throw new Error(`Wrong Mac architecture: ${arch}`);
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
  // Check that the packaged executable starts without exiting or crashing.
  const child = spawn(binary, [], { stdio: 'ignore' });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.removeListener('exit', earlyExit);
      child.kill('SIGTERM');
      resolve();
    }, 10000);
    const earlyExit = (code, signal) => {
      clearTimeout(timer);
      reject(new Error(`Mac app exited during startup: ${code ?? signal}`));
    };
    child.once('exit', earlyExit);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}
const bundle = path.join(built, 'bundle', windows ? 'nsis' : linux ? 'appimage' : 'dmg');
const extension = windows ? '.exe' : linux ? '.AppImage' : '.dmg';
const installers = fs.readdirSync(bundle).filter((name) => name.endsWith(extension));
if (installers.length !== 1)
  throw new Error(`Expected one ${extension} installer, got ${installers.length}.`);
const installer = path.join(bundle, installers[0]);
if (!windows && !linux) execFileSync('hdiutil', ['verify', installer], { stdio: 'inherit' });
const name = `SpacePreview-${version}-${platform}${windows ? '-setup.exe' : extension}`;
fs.copyFileSync(installer, path.join(destination, name));
// Windows and Linux use the installer directly; macOS requires the signed .app archive.
const updateName = updateAssetName(version, platform);
const updateFile =
  windows || linux ? installer : path.join(built, 'bundle', 'macos', 'SpacePreview.app.tar.gz');
if (!fs.statSync(updateFile).size) throw new Error('Empty updater artifact.');
const signature = fs.readFileSync(`${updateFile}.sig`, 'utf8').trim();
if (!signature) throw new Error('Missing updater signature.');
if (!windows && !linux) fs.copyFileSync(updateFile, path.join(destination, updateName));
fs.writeFileSync(path.join(destination, `${updateName}.sig`), `${signature}\n`);
console.log(`Verified ${platform}: ${name}`);
