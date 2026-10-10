import { readFile, writeFile } from 'node:fs/promises';
import { zipSync, unzipSync, strToU8 } from 'fflate';
import './reading-fixtures.mjs';
const root = new URL('../test-results/fixtures/', import.meta.url);
const entries = {
  'docs/readme.txt': strToU8('大压缩包内部中文预览'),
  'large.bin': new Uint8Array(40 * 1024 * 1024),
};
for (let i = 0; i < 215; i++)
  entries[`items/file-${String(i).padStart(3, '0')}.txt`] = strToU8(`文件 ${i}`);
await writeFile(new URL('large.zip', root), zipSync(entries, { level: 0 }));
await writeFile(new URL('large.log', root), '中文日志记录\n'.repeat(80000) + '文件末尾标记');
await writeFile(
  new URL('large-33mb.log', root),
  ('中文日志 ' + 'a'.repeat(4096) + '\n').repeat(8500) + '超过 32 MB 文件末尾标记',
);
await writeFile(
  new URL('large.ts', root),
  'const exampleValue = "完整代码预览内容";\n'.repeat(12000) +
    'const finalMarker = "代码末尾标记";',
);
const word = unzipSync(new Uint8Array(await readFile(new URL('样式文档.docx', root))));
for (let i = 0; i < 5; i++) word[`word/media/padding-${i}.bin`] = new Uint8Array(8 * 1024 * 1024);
await writeFile(new URL('large.docx', root), zipSync(word, { level: 0 }));
await writeFile(
  new URL('large.md', root),
  '# 完整文档\n\n' +
    '这是完整阅读中的一段文字。\n\n'.repeat(30000) +
    '## 文档结尾\n\n完整 Markdown 末尾标记',
);
await writeFile(
  new URL('large-utf16.txt', root),
  Buffer.from('中文完整文档\n'.repeat(80000) + 'UTF16 文件末尾标记', 'utf16le'),
);
