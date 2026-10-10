import { mkdir, writeFile } from 'node:fs/promises';
import UTIF from 'utif';
const root = new URL('../test-results/fixtures/', import.meta.url);
await mkdir(root, { recursive: true });
await writeFile(
  new URL('网页样式.html', root),
  `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#f2f5fb;font-family:"Microsoft YaHei",sans-serif;color:#18283b}.card{margin:40px;padding:32px;background:white;border-radius:12px;border-top:6px solid #7859bd}h1{font-size:32px;color:#7859bd}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.tile{padding:20px;background:#f2f5fb}a{color:#7859bd}</style><script>window.untrustedRan=true;fetch('https://example.invalid/secret');</script></head><body><main class="card"><h1>网页，保留原有设计</h1><p style="font-size:18px">HTML 内嵌样式、字体、色彩和布局现在都可以预览。</p><div class="grid"><section class="tile"><h2>网页预览</h2><p>保留静态页面排版。</p></section><section class="tile"><h2>阅读与源码</h2><p>一键切换，方便阅读和检查代码。</p></section></div><a href="#detail">查看说明</a><h2 id="detail">文件内容</h2><p>只读查看，不执行网页脚本。</p><img src="https://example.invalid/track.png"><form action="https://example.invalid/submit"><input name="secret"></form></main></body></html>`,
);
await writeFile(
  new URL('Dockerfile.dev', root),
  'FROM node:22\nWORKDIR /app\nCOPY . .\nRUN npm ci\nCMD ["npm", "start"]\n',
);
await writeFile(
  new URL('CMakeLists.txt', root),
  'cmake_minimum_required(VERSION 3.20)\nproject(SpacePreview)\nadd_executable(preview main.cpp)\n',
);
await writeFile(
  new URL('代码.psm1', root),
  'function Read-Preview {\n  param([string]$Path)\n  Write-Output "文件: $Path"\n}\n',
);
await writeFile(
  new URL('机械图纸.dxf', root),
  `0
SECTION
2
ENTITIES
0
LWPOLYLINE
8
边框
62
4
90
4
70
1
10
0
20
0
10
160
20
0
10
160
20
100
10
0
20
100
0
CIRCLE
8
孔位
62
2
10
40
20
50
40
14
0
CIRCLE
8
孔位
62
2
10
120
20
50
40
14
0
LINE
8
中心线
62
3
10
0
20
50
11
160
21
50
0
ARC
8
边框
62
4
10
80
20
50
40
30
50
0
51
180
0
TEXT
8
文字
10
38
20
112
40
8
1
DXF 图纸预览
0
ENDSEC
0
EOF
`,
);
const vertices = [
  [0, 0, 0],
  [1, 0, 0],
  [0.5, 1, 0],
  [0.5, 0.4, 1],
];
const faces = [
  [0, 2, 1],
  [0, 1, 3],
  [1, 2, 3],
  [2, 0, 3],
];
await writeFile(
  new URL('四面体.obj', root),
  vertices.map((p) => `v ${p.join(' ')}`).join('\n') +
    '\n' +
    faces.map((f) => `f ${f.map((i) => i + 1).join(' ')}`).join('\n'),
);
const mesh = Buffer.alloc(84 + faces.length * 50);
mesh.write('SpacePreview binary STL');
mesh.writeUInt32LE(faces.length, 80);
faces.forEach((face, i) =>
  face.forEach((v, j) =>
    vertices[v].forEach((n, k) => mesh.writeFloatLE(n, 84 + i * 50 + 12 + j * 12 + k * 4)),
  ),
);
await writeFile(new URL('四面体.stl', root), mesh);
const w = 320,
  h = 220,
  pixels = new Uint8Array(w * h * 4);
for (let y = 0; y < h; y++)
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    pixels[i] = Math.round((x / w) * 240);
    pixels[i + 1] = Math.round((y / h) * 200);
    pixels[i + 2] = 160;
    pixels[i + 3] = 255;
  }
await writeFile(new URL('渐变图像.tiff', root), new Uint8Array(UTIF.encodeImage(pixels, w, h)));
