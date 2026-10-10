import { expect, it } from 'vitest';
import { readNotebook } from './notebook';
import { readFictionBook } from './extra-formats';
const bytes = (text: string) => new TextEncoder().encode(text);
it('renders saved notebook code and text output without trusting output HTML', async () => {
  const notebook = {
    nbformat: 4,
    metadata: { language_info: { name: 'python' } },
    cells: [
      { cell_type: 'markdown', source: ['# 标题'] },
      {
        cell_type: 'code',
        source: ['print("<script>")'],
        outputs: [
          { output_type: 'stream', text: ['<script>恶意输出</script>'] },
          {
            output_type: 'display_data',
            data: { 'text/html': '<script>run()</script>', 'text/plain': '保存的结果' },
          },
        ],
      },
    ],
  };
  const result = await readNotebook(
    bytes(JSON.stringify(notebook)),
    async (text) => `<h1>${text}</h1>`,
    (text) => text.replace(/</g, '&lt;'),
  );
  expect(result.html).toContain('保存的结果');
  expect(result.html).toContain('&lt;script&gt;恶意输出');
  expect(result.html).not.toContain('run()');
  expect(result.note).toContain('不执行');
  await expect(
    readNotebook(
      bytes('{"nbformat":3,"cells":[]}'),
      async (t) => t,
      (t) => t,
    ),
  ).rejects.toThrow('v4');
  await expect(
    readNotebook(
      bytes(JSON.stringify({ nbformat: 4, cells: Array(501).fill({}) })),
      async (t) => t,
      (t) => t,
    ),
  ).rejects.toThrow('500');
});
it('reads FB2 chapter titles and emphasis, excluding binary images and external resources', () => {
  const result = readFictionBook(
    bytes(
      '<FictionBook><description><title-info><book-title>书名</book-title></title-info></description><body><title><p>阅读时光</p></title><section><title><p>第一章</p></title><p>保留<emphasis>强调</emphasis>与<strong>重点</strong>。</p><image href="https://example.com/a.png"/></section></body><binary>ignore</binary></FictionBook>',
    ),
  );
  expect(result.html).toContain('<h1>阅读时光</h1>');
  expect(result.html).toContain('<h2>第一章</h2>');
  expect(result.html).toContain('<em>强调</em>');
  expect(result.html).not.toContain('https://');
  expect(result.html).not.toContain('ignore');
  expect(() => readFictionBook(bytes('<!DOCTYPE x [<!ENTITY bad "x">]><FictionBook/>'))).toThrow(
    '实体',
  );
});
it('honors FB2 XML encoding declarations and UTF16 byte order', () => {
  const prefix = bytes('<?xml version="1.0" encoding="windows-1251"?><FictionBook><body><p>');
  const suffix = bytes('</p></body></FictionBook>');
  const encoded = new Uint8Array(prefix.length + 6 + suffix.length);
  encoded.set(prefix);
  encoded.set([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2], prefix.length);
  encoded.set(suffix, prefix.length + 6);
  expect(readFictionBook(encoded).html).toContain('Привет');
  const text =
    '<?xml version="1.0" encoding="UTF-16"?><FictionBook><body><p>中文</p></body></FictionBook>';
  const utf16 = new Uint8Array(2 + text.length * 2);
  utf16.set([0xfe, 0xff]);
  const view = new DataView(utf16.buffer);
  for (let i = 0; i < text.length; i++) view.setUint16(2 + i * 2, text.charCodeAt(i), false);
  expect(readFictionBook(utf16).html).toContain('中文');
});
