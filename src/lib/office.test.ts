import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { readWorkbook, readSlides, columnIndex, columnName } from './office';

function zip(parts: Record<string, string>) {
  return zipSync(
    Object.fromEntries(Object.entries(parts).map(([name, text]) => [name, strToU8(text)])),
  );
}
const workbook =
  '<workbook xmlns:r="r"><sheets><sheet name="销售" sheetId="1" r:id="rId1"/><sheet name="空表" sheetId="2" r:id="rId2"/></sheets></workbook>';
const relations =
  '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>';
describe('OOXML read-only parsing', () => {
  it('preserves sheet names, sparse coordinates, Unicode and saved formula results', () => {
    const sheets = readWorkbook(
      zip({
        'xl/workbook.xml': workbook,
        'xl/_rels/workbook.xml.rels': relations,
        'xl/sharedStrings.xml':
          '<sst><si><t>产品</t></si><si><r><t>合</t></r><r><t>计</t></r></si></sst>',
        'xl/worksheets/sheet1.xml':
          '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1"><f>1+2</f><v>3</v></c></row><row r="3"><c r="A3" t="s"><v>1</v></c><c r="B3"><f>1+2</f></c></row></sheetData></worksheet>',
        'xl/worksheets/sheet2.xml': '<worksheet><sheetData/></worksheet>',
      }),
    );
    expect(sheets.map((s) => s.name)).toEqual(['销售', '空表']);
    expect(sheets[0].rows[0][0]).toBe('产品');
    expect(sheets[0].rows[0][2]).toBe('3');
    expect(sheets[0].rows[1]).toEqual([]);
    expect(sheets[0].rows[2]).toEqual(['合计', '（公式无缓存结果）']);
    expect(sheets[1].rows).toEqual([]);
  });
  it('caps huge sparse worksheets instead of allocating the declared dimensions', () => {
    const sheets = readWorkbook(
      zip({
        'xl/workbook.xml': workbook,
        'xl/_rels/workbook.xml.rels': relations,
        'xl/worksheets/sheet1.xml':
          '<worksheet><dimension ref="A1:XFD1048576"/><sheetData><row r="1048576"><c r="XFD1048576"><v>1</v></c></row></sheetData></worksheet>',
      }),
    );
    expect(sheets[0].rows).toHaveLength(0);
    expect(sheets[0].truncated).toBe(true);
  });
  it('rejects XML entities', () => {
    expect(() =>
      readWorkbook(
        zip({ 'xl/workbook.xml': '<!DOCTYPE workbook [<!ENTITY x "boom">]><workbook/>' }),
      ),
    ).toThrow('实体');
  });
  it('preserves presentation order and combines rich text runs', () => {
    const slides = readSlides(
      zip({
        'ppt/presentation.xml':
          '<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId r:id="r2"/><p:sldId r:id="r1"/></p:sldIdLst></p:presentation>',
        'ppt/_rels/presentation.xml.rels':
          '<Relationships><Relationship Id="r1" Target="slides/slide1.xml"/><Relationship Id="r2" Target="slides/slide2.xml"/></Relationships>',
        'ppt/slides/slide1.xml':
          '<sld><cSld><spTree><sp><txBody><p><r><t>第一张</t></r></p></txBody></sp></spTree></cSld></sld>',
        'ppt/slides/slide2.xml':
          '<sld><cSld><spTree><sp><txBody><p><r><t>新的</t></r><r><t>标题</t></r></p><p><r><t>内容</t></r></p></txBody></sp></spTree></cSld></sld>',
      }),
    );
    expect(slides).toEqual([
      { title: '新的标题', paragraphs: ['内容'] },
      { title: '第一张', paragraphs: [] },
    ]);
  });
  it('maps spreadsheet columns without off-by-one errors', () => {
    expect(columnIndex('AA12')).toBe(26);
    expect(columnIndex('CV1')).toBe(99);
    expect(columnName(26)).toBe('AA');
    expect(columnName(99)).toBe('CV');
  });
  it('keeps spaces, tabs, breaks and fields in their original slide text order', () => {
    const slides = readSlides(
      zip({
        'ppt/presentation.xml':
          '<presentation xmlns:r="r"><sldIdLst><sldId r:id="r1"/><sldId r:id="r2"/></sldIdLst></presentation>',
        'ppt/_rels/presentation.xml.rels':
          '<Relationships><Relationship Id="r1" Target="slides/slide1.xml"/><Relationship Id="r2" Target="slides/slide2.xml"/></Relationships>',
        'ppt/slides/slide1.xml':
          '<sld><sp><txBody><p><r><t>CREATE </t></r><r><t>TABLE </t></r><r><t>customer</t></r></p><p><r><t>  id</t></r><tab/><r><t>INT, </t></r><br/><r><t>  name </t></r><fld><t>VARCHAR</t></fld><r><t>(50)</t></r></p></txBody></sp></sld>',
        'ppt/slides/slide2.xml': '<sld><cSld><spTree><pic/></spTree></cSld></sld>',
      }),
    );
    expect(slides[0]).toEqual({
      title: 'CREATE TABLE customer',
      paragraphs: ['  id\tINT, \n  name VARCHAR(50)'],
    });
    expect(slides[1]).toEqual({ title: '无文字内容', paragraphs: [] });
  });
});
