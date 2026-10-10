import { mkdir, writeFile } from 'node:fs/promises';
import { zipSync, strToU8 } from 'fflate';
const root = new URL('../test-results/fixtures/', import.meta.url);
await mkdir(root, { recursive: true });
await writeFile(
  new URL('license.dat', root),
  'License information\n授权状态：有效\n有效期：2027-12-31\n',
);
await writeFile(
  new URL('unicode.txt', root),
  Buffer.from('Windows UTF16\n中文内容没有乱码\n', 'utf16le'),
);
await writeFile(new URL('gbk.txt', root), Buffer.from([0xd6, 0xd0, 0xce, 0xc4]));
await writeFile(new URL('western.txt', root), Buffer.from([0x63, 0x61, 0x66, 0xe9]));
await writeFile(
  new URL('安全阅读.html', root),
  '<h1>HTML 阅读</h1><p>保留文档内容</p><script>window.untrustedRan=true</script><img src="https://example.com/tracker.png"><form><input value="remove"></form>',
);
await writeFile(
  new URL('阅读体验.md', root),
  '# 留白，让阅读更从容\n\n一份文档，一次空格。左侧目录让内容更容易寻找。\n\n## 清晰的层级\n\n保留 **强调**、*引用语气* 和 `代码片段`，统一排版而不改变内容。\n\n> 阅读的重点，始终是内容本身。\n\n### 今日清单\n\n- [x] 单次空格预览\n- [x] 文档大纲导航\n- [ ] 下一份灵感\n\n## 数据一览\n\n| 格式 | 阅读方式 |\n| --- | --- |\n| Markdown | 阅读排版与大纲 |\n| Word | 页面样式与图片 |\n\n## 代码示例\n\n```js\nconst reading = true;\nconsole.log("你好，世界");\n```\n\n[回到层级](#清晰的层级)\n',
);
await writeFile(
  new URL('rich.rtf', root),
  '{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0 Calibri;}}\\f0\\fs28 RTF preview\\par \\b Bold content\\b0 \\par Unicode: \\u20013?\\u25991?\\par}',
);
const image = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5r8AAAAASUVORK5CYII=',
  'base64',
);
const xml = {
  '[Content_Types].xml':
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
  '_rels/.rels':
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="doc" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  'word/_rels/document.xml.rels':
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="image" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/></Relationships>',
  'word/styles.xml':
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Calibri" w:eastAsia="Microsoft YaHei"/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="285E80"/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style></w:styles>',
  'word/document.xml': `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>保持文档原有的表达</w:t></w:r></w:p><w:p><w:r><w:t>页面尺寸、标题样式、段落和表格，在本地还原。</w:t></w:r></w:p><w:p><w:r><w:drawing><wp:inline><wp:extent cx="457200" cy="457200"/><wp:docPr id="1" name="logo"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="image"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="457200" cy="457200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p><w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>本周重点</w:t></w:r></w:p><w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders><w:bottom w:val="single" w:sz="8" w:color="285E80"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="4500"/><w:gridCol w:w="4500"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:shd w:fill="EAF3FF"/></w:tcPr><w:p><w:r><w:t>项目</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>状态</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>样式与图片</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>保留</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:pPr><w:pageBreakBefore/><w:outlineLvl w:val="1"/></w:pPr><w:r><w:t>下一页计划</w:t></w:r></w:p><w:p><w:r><w:t>这一段位于显式分页之后。</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr></w:body></w:document>`,
};
const parts = Object.fromEntries(Object.entries(xml).map(([name, text]) => [name, strToU8(text)]));
parts['word/media/logo.png'] = image;
await writeFile(new URL('样式文档.docx', root), zipSync(parts));
parts['word/theme/theme1.xml'] = strToU8(
  '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:themeElements><a:fontScheme name="阅读字体"><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:font script="Hans" typeface="宋体"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>',
);
parts['word/settings.xml'] = strToU8(
  '<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:themeFontLang w:eastAsia="zh-CN"/></w:settings>',
);
parts['word/styles.xml'] = strToU8(
  xml['word/styles.xml'].replace('w:eastAsia="Microsoft YaHei"', 'w:eastAsiaTheme="minorEastAsia"'),
);
await writeFile(new URL('主题字体.docx', root), zipSync(parts));
await writeFile(
  new URL('阅读时光.fb2', root),
  '<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><body><title><p>阅读时光</p></title><section><title><p>第一章：留白</p></title><p>一段<emphasis>安静</emphasis>的阅读。</p></section><section><title><p>第二章：前行</p></title><p>继续下一段旅程。</p></section></body></FictionBook>',
);
await writeFile(
  new URL('分析笔记.ipynb', root),
  JSON.stringify({
    nbformat: 4,
    metadata: { language_info: { name: 'python' } },
    cells: [
      { cell_type: 'markdown', source: ['# 分析笔记\n\n保持代码与说明一起阅读。'] },
      {
        cell_type: 'code',
        source: ['print("你好，Notebook")'],
        outputs: [{ output_type: 'stream', text: ['你好，Notebook\n'] }],
      },
      { cell_type: 'markdown', source: ['## 保存的结论\n\n- 只读预览\n- 保留文本输出'] },
    ],
  }),
);
await writeFile(
  new URL('editor.ts', root),
  '// IDEA 风格：等宽字体与清晰的语法层级\ninterface PreviewOptions {\n    title: string;\n    enabled: boolean;\n}\n\nfunction preview(options: PreviewOptions) {\n    const message = "你好，SpacePreview";\n    const delay = 120;\n    return options.enabled ? message : null;\n}\n',
);
