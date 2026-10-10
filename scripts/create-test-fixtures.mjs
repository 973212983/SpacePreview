// Small synthetic files for manual browser/desktop smoke tests. Contains no user data.
import { mkdir, writeFile } from 'node:fs/promises';
import { zipSync, strToU8 } from 'fflate';

const destination = new URL('../test-results/fixtures/', import.meta.url);
await mkdir(destination, { recursive: true });
const content = 'BT /F1 24 Tf 72 720 Td (SpacePreview PDF smoke test) Tj ET';
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
];
let pdf = '%PDF-1.4\n';
const offsets = [0];
for (const [i, object] of objects.entries()) {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
}
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
pdf += offsets
  .slice(1)
  .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
  .join('');
pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
await writeFile(new URL('smoke.pdf', destination), pdf);
await writeFile(
  new URL('smoke.docx', destination),
  zipSync({
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    ),
    '_rels/.rels': strToU8(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    ),
    'word/document.xml': strToU8(
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>瞬览 DOCX 中文解析测试</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Product</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>12000</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>',
    ),
  }),
);
await writeFile(new URL('firmware.bin', destination), Buffer.from([127, 69, 76, 70, 0, 1, 2, 3]));
await writeFile(
  new URL('untrusted.md', destination),
  '# Safe heading\n\n<script>document.body.innerHTML="UNSAFE"</script>\n\n<img src="https://example.invalid/track" onerror="alert(1)">\n\n[unsafe](javascript:alert(1))\n\n**Visible text**\n',
);
console.log('Created PDF, DOCX, binary, and untrusted Markdown fixtures in test-results/fixtures.');
const workbookParts = {
  'xl/workbook.xml':
    '<workbook xmlns:r="r"><sheets><sheet name="销售" sheetId="1" r:id="r1"/><sheet name="汇总" sheetId="2" r:id="r2"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels':
    '<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/><Relationship Id="r2" Target="worksheets/sheet2.xml"/></Relationships>',
  'xl/worksheets/sheet1.xml':
    '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>产品</t></is></c><c r="B1" t="inlineStr"><is><t>收入</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>瞬览</t></is></c><c r="B2"><v>12000</v></c></row></sheetData></worksheet>',
  'xl/worksheets/sheet2.xml':
    '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>总收入</t></is></c><c r="B1"><f>销售!B2</f><v>12000</v></c></row></sheetData></worksheet>',
};
await writeFile(
  new URL('smoke.xlsx', destination),
  zipSync(
    Object.fromEntries(
      Object.entries(workbookParts).map(([name, content]) => [name, strToU8(content)]),
    ),
  ),
);
const slidesParts = {
  'ppt/presentation.xml':
    '<presentation xmlns:r="r"><sldIdLst><sldId r:id="r1"/><sldId r:id="r2"/></sldIdLst></presentation>',
  'ppt/_rels/presentation.xml.rels':
    '<Relationships><Relationship Id="r1" Target="slides/slide1.xml"/><Relationship Id="r2" Target="slides/slide2.xml"/></Relationships>',
  'ppt/slides/slide1.xml':
    '<sld><cSld><spTree><sp><txBody><p><r><t>瞬览，让内容即刻呈现</t></r></p><p><r><t>跨平台文件预览工具</t></r></p></txBody></sp></spTree></cSld></sld>',
  'ppt/slides/slide2.xml':
    '<sld><cSld><spTree><sp><txBody><p><r><t>第二张幻灯片</t></r></p><p><r><t>翻页测试通过</t></r></p></txBody></sp></spTree></cSld></sld>',
};
await writeFile(
  new URL('smoke.pptx', destination),
  zipSync(
    Object.fromEntries(
      Object.entries(slidesParts).map(([name, content]) => [name, strToU8(content)]),
    ),
  ),
);
console.log('Created XLSX and PPTX fixtures.');
