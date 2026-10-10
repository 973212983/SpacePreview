import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { readDelimited, readEpub, readOpenDocument } from './extra-formats';
import { detectKind } from './files';

const odf = (body: string) =>
  zipSync({
    'content.xml': strToU8(
      `<office:document-content xmlns:office="office" xmlns:text="text" xmlns:table="table" xmlns:draw="draw"><office:body>${body}</office:body></office:document-content>`,
    ),
  });
describe('additional preview formats', () => {
  it('routes new document, table, book and source extensions', () => {
    for (const [name, kind] of [
      ['data.CSV', 'csv'],
      ['data.tsv', 'csv'],
      ['draft.ott', 'odt'],
      ['sheet.ods', 'ods'],
      ['slides.odp', 'odp'],
      ['book.epub', 'epub'],
      ['main.mjs', 'text'],
      ['captions.srt', 'text'],
      ['.editorconfig', 'text'],
    ])
      expect(detectKind(name)).toBe(kind);
  });
  it('reads CSV quoted delimiters, escaped quotes, multiline cells and empty trailing fields', () => {
    expect(
      readDelimited(strToU8('\uFEFFname,note,empty\r\n张三,"a,b\n""quoted""",\r\n'), 'a.csv').rows,
    ).toEqual([
      ['name', 'note', 'empty'],
      ['张三', 'a,b\n"quoted"', ''],
    ]);
    expect(readDelimited(strToU8('a;b\n1;2'), 'a.csv').rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(readDelimited(strToU8('a\tb\n1\t2'), 'a.tsv').columns).toBe(2);
    expect(() => readDelimited(strToU8('a,"broken'), 'a.csv')).toThrow('引号');
  });
  it('reads all CSV rows and columns without evaluating formulas', () => {
    const sheet = readDelimited(
      strToU8(
        Array(5002)
          .fill('=1+1,' + Array(101).fill('x').join(','))
          .join('\n'),
      ),
      'large.csv',
    );
    expect(sheet.rows).toHaveLength(5002);
    expect(sheet.columns).toBe(102);
    expect(sheet.truncated).toBe(false);
    expect(sheet.rows[0][0]).toBe('=1+1');
    expect(sheet.rows[5001][101]).toBe('x');
  });
  it('handles many TSV rows without spreading row counts into function arguments', () => {
    const sheet = readDelimited(strToU8('a\tb\n'.repeat(150000) + '末行\t完整'), 'large.tsv');
    expect(sheet.rows).toHaveLength(150001);
    expect(sheet.columns).toBe(2);
    expect(sheet.rows.at(-1)).toEqual(['末行', '完整']);
    expect(sheet.truncated).toBe(false);
  });
  it('validates quoted CSV fields beyond the former row limit', () => {
    expect(() => readDelimited(strToU8('a,b\n'.repeat(5000) + 'x,"broken'), 'late.csv')).toThrow(
      '引号',
    );
  });
  it('keeps ODT inline text order and escapes markup', () => {
    const result = readOpenDocument(
      odf(
        '<office:text><text:h>标题</text:h><text:p>前<text:span>中</text:span>后 &lt;img&gt;</text:p><table:table><table:table-row><table:table-cell><text:p>格子</text:p></table:table-cell></table:table-row></table:table></office:text>',
      ),
      'odt',
    );
    expect(result.html).toContain('<p>前中后 &lt;img&gt;</p>');
    expect(result.html).toContain('<table><tr><td><p>格子</p></td></tr></table>');
  });
  it('reads ODS repeated cells, empty gaps, cached values and multiple sheets', () => {
    const result = readOpenDocument(
      odf(
        '<office:spreadsheet><table:table table:name="预算"><table:table-row table:number-rows-repeated="2"><table:table-cell table:number-columns-repeated="3" office:value="12"/><table:table-cell office:date-value="2026-09-17"/></table:table-row></table:table><table:table table:name="空表"/></office:spreadsheet>',
      ),
      'ods',
    );
    expect(result.sheets?.[0].rows).toEqual([
      ['12', '12', '12', '2026-09-17'],
      ['12', '12', '12', '2026-09-17'],
    ]);
    expect(result.sheets?.[1].name).toBe('空表');
  });
  it('bounds ODS repetition expansion and keeps ODP page order', () => {
    const result = readOpenDocument(
      odf(
        '<office:spreadsheet><table:table><table:table-row table:number-rows-repeated="999999999"><table:table-cell table:number-columns-repeated="999999999" office:value="x"/></table:table-row></table:table></office:spreadsheet>',
      ),
      'ods',
    );
    expect(result.sheets?.[0].rows).toHaveLength(5000);
    expect(result.sheets?.[0].columns).toBe(100);
    const slides = readOpenDocument(
      odf(
        '<office:presentation><draw:page><text:p>第一页</text:p><text:p>正文</text:p></draw:page><draw:page><text:p>第二页</text:p></draw:page></office:presentation>',
      ),
      'odp',
    );
    expect(slides.slides?.map((s) => s.title)).toEqual(['第一页', '第二页']);
    expect(slides.slides?.[0].paragraphs).toEqual(['正文']);
  });
  it('rejects entity declarations', () => {
    expect(() =>
      readOpenDocument(
        zipSync({
          'content.xml': strToU8('<!DOCTYPE x [<!ENTITY x SYSTEM "file:///secret">]><x/>'),
        }),
        'odt',
      ),
    ).toThrow('实体');
  });
});

function epub(href = 'one.xhtml') {
  return zipSync({
    'META-INF/container.xml': strToU8(
      '<container><rootfiles><rootfile full-path="Book/book.opf"/></rootfiles></container>',
    ),
    'Book/book.opf': strToU8(
      `<package><manifest><item id="a" href="${href}" media-type="application/xhtml+xml"/><item id="b" href="two.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="b"/><itemref idref="a"/></spine></package>`,
    ),
    'Book/one.xhtml': strToU8(
      '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd"><html><body><h1>第一章</h1><p>前<strong>中</strong>后</p><script>alert(1)</script><img src="https://example.com/tracker"/></body></html>',
    ),
    'Book/two.xhtml': strToU8('<html><body><h1>第二章</h1><p>文字</p></body></html>'),
  });
}
it('reads EPUB in spine order and excludes scripts and external resources', () => {
  const result = readEpub(epub());
  expect(result.chapters?.map((c) => c.title)).toEqual(['第二章', '第一章']);
  expect(result.chapters?.[1].html).toContain('前<strong>中</strong>后');
  expect(result.chapters?.[1].html).not.toMatch(/alert|tracker|script|img/);
  expect(() => readEpub(epub('https://example.com/book'))).toThrow('路径');
  expect(() => readEpub(epub('../../secret.xhtml'))).toThrow('路径');
});
