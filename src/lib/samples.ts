import { zipSync, strToU8 } from 'fflate';
import type { PreviewFile } from './files';

const guide = `# 好的工具，让注意力回到内容。\n\n欢迎使用 **瞬览 SpacePreview**。不必启动一个庞大的应用，只为看一眼文件。\n\n---\n\n## 一次空格，刚刚好\n\n选中文件，按下空格。图片、文档、代码，所有内容在同一个安静的窗口里呈现。\n\n> “我不想打开这个文件，我只是想看一眼。”\n\n### 为日常工作准备\n\n- **阅读更专注** — Markdown 标题、引用、代码块与表格\n- **开发者友好** — 语法高亮、JSON 格式化、行号与文本查找\n- **文件留在本地** — 不上传内容，也不运行文件中的代码\n\n### 快捷键\n\n| 按键 | 操作 |\n| --- | --- |\n| Space / Esc | 关闭预览 |\n| ← / → | 切换已载入的文件 |\n| Shift + Space | 切换纯文本预览 |\n| Ctrl + O | 选择文件 |\n| Enter | 用默认应用打开（桌面版） |\n\n\`\`\`typescript\nconst preview = await space.open(file);\n// 少一点等待，多一点心流。\n\`\`\`\n\n---\n\n*这是内置示例。你的文件，只属于你。*\n`;
const code = `import { createPreview } from '@space/core';\n\n/** A little less opening. A little more seeing. */\ninterface PreviewOptions {\n  theme: 'system' | 'light' | 'dark';\n  readOnly: boolean;\n  maxBytes: number;\n}\n\nconst options: PreviewOptions = {\n  theme: 'system',\n  readOnly: true,\n  maxBytes: 512 * 1024,\n};\n\nexport async function peek(file: File) {\n  const start = performance.now();\n  const preview = await createPreview(file, options);\n\n  console.info('Ready in', performance.now() - start, 'ms');\n  return preview;\n}\n`;
const landscape = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1100" viewBox="0 0 1600 1100"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#d5e3d8"/><stop offset="1" stop-color="#f6e9ce"/></linearGradient><linearGradient id="hill" x2=".4" y2="1"><stop stop-color="#749a81"/><stop offset="1" stop-color="#315c54"/></linearGradient></defs><path fill="url(#sky)" d="M0 0h1600v1100H0z"/><circle cx="1120" cy="280" r="107" fill="#fff5da"/><path d="M0 710 370 370 700 710 980 460 1600 820V1100H0" fill="#b0c2ad"/><path d="M0 940 510 510 900 950 1230 600 1600 850V1100H0" fill="url(#hill)"/><path d="M0 960Q500 780 870 1010T1600 950V1100H0" fill="#234f49"/><text x="90" y="130" fill="#436152" font-family="sans-serif" font-size="22" letter-spacing="8">A MOMENT OF STILLNESS</text><text x="90" y="1030" fill="#d4e3d8" font-family="sans-serif" font-size="17" letter-spacing="4">SPACEPREVIEW / SAMPLE LANDSCAPE</text></svg>`;

function sample(name: string, content: BlobPart, type = 'text/plain'): PreviewFile {
  const blob = new Blob([content], { type });
  return {
    id: `sample:${name}`,
    name,
    size: blob.size,
    modified: new Date('2026-09-15T09:00:00+08:00').getTime(),
    mime: type,
    blob,
  };
}
export const samples = [
  sample('开始于一次空格.md', guide, 'text/markdown'),
  sample('山间片刻.svg', landscape, 'image/svg+xml'),
  sample('preview.ts', code),
  sample(
    'project.zip',
    zipSync({
      'project/README.md': strToU8(guide),
      'project/src/preview.ts': strToU8(code),
      'project/package.json': strToU8('{"name":"a-little-peek","version":"1.0.0"}'),
      'project/assets/landscape.svg': strToU8(landscape),
    }) as Uint8Array<ArrayBuffer>,
    'application/zip',
  ),
];
