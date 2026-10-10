import { mkdir, writeFile } from 'node:fs/promises';
import { zipSync, strToU8 } from 'fflate';

const destination = new URL('../test-results/fixtures/', import.meta.url);
await mkdir(destination, { recursive: true });
const odf = (body) =>
  zipSync({
    'content.xml': strToU8(
      `<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"><office:body>${body}</office:body></office:document-content>`,
    ),
  });
await writeFile(
  new URL('阅读笔记.odt', destination),
  odf(
    '<office:text><text:h>把时间留给内容</text:h><text:p>一次空格，快速浏览。紧凑的工具栏，让文档拥有更多空间。</text:p><text:h>阅读清单</text:h><text:p>保留段落、标题与表格。文字清晰，浏览轻松。</text:p><table:table><table:table-row><table:table-cell><text:p>项目</text:p></table:table-cell><table:table-cell><text:p>状态</text:p></table:table-cell></table:table-row><table:table-row><table:table-cell><text:p>预览新格式</text:p></table:table-cell><table:table-cell><text:p>已完成</text:p></table:table-cell></table:table-row></table:table></office:text>',
  ),
);
await writeFile(
  new URL('项目清单.csv', destination),
  '项目,负责人,状态,备注\r\n布局优化,林晓,完成,"头部 42px，底部 30px"\r\n格式支持,陈晨,完成,"CSV、OpenDocument、EPUB"\r\n' +
    Array.from({ length: 80 }, (_, i) => `记录 ${i + 1},团队,待确认,只读预览`).join('\r\n'),
);
await writeFile(
  new URL('预算.ods', destination),
  odf(
    '<office:spreadsheet><table:table table:name="本月预算"><table:table-row><table:table-cell><text:p>设计</text:p></table:table-cell><table:table-cell office:value="1200"/></table:table-row></table:table><table:table table:name="下月预算"><table:table-row><table:table-cell><text:p>研发</text:p></table:table-cell><table:table-cell office:value="2400"/></table:table-row></table:table></office:spreadsheet>',
  ),
);
await writeFile(
  new URL('概览.odp', destination),
  odf(
    '<office:presentation><draw:page><text:p>更专注的预览体验</text:p><text:p>少一点界面，多一点内容。</text:p></draw:page><draw:page><text:p>更多文件格式</text:p><text:p>常见文档、表格与电子书。</text:p></draw:page></office:presentation>',
  ),
);
await writeFile(
  new URL('阅读时光.epub', destination),
  zipSync({
    mimetype: strToU8('application/epub+zip'),
    'META-INF/container.xml': strToU8(
      '<container><rootfiles><rootfile full-path="Book/book.opf"/></rootfiles></container>',
    ),
    'Book/book.opf': strToU8(
      '<package><manifest><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/><item id="two" href="two.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>',
    ),
    'Book/one.xhtml': strToU8(
      '<html><body><h1>第一章 · 留一点时间阅读</h1><p>打开一本书，让注意力回到文字本身。</p><blockquote>不必打开应用，先读一段。</blockquote><p>通过顶部的章节选择器，你可以直接跳转到感兴趣的部分。</p></body></html>',
    ),
    'Book/two.xhtml': strToU8(
      '<html><body><h1>第二章 · 下一段旅程</h1><p>章节顺序来自书籍本身，文字在本地解析。</p></body></html>',
    ),
  }),
);
