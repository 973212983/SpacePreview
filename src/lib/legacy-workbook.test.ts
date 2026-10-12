import { describe, expect, it } from 'vitest';
import { utils, write, set_cptable } from 'xlsx';
import { readLegacyWorkbook } from './legacy-workbook';
describe('legacy Excel content', () => {
  it.each(['dif', 'sylk'] as const)(
    'decodes %s text as Unicode before parsing table values',
    async (bookType) => {
      const book = utils.book_new();
      utils.book_append_sheet(
        book,
        utils.aoa_to_sheet([
          ['name', 'amount'],
          ['中文工作簿', 123],
        ]),
        'data',
      );
      const bytes = new Uint8Array(write(book, { type: 'array', bookType, codepage: 65001 }));
      const sheets = await readLegacyWorkbook(bytes, `sample.${bookType}`);
      expect(sheets[0].rows[1]).toEqual(['中文工作簿', '123']);
    },
  );
  it('reads GBK DBF text beside arbitrary binary numeric fields', async () => {
    set_cptable(await import('xlsx/dist/cpexcel.full.mjs'));
    const book = utils.book_new();
    utils.book_append_sheet(
      book,
      utils.aoa_to_sheet([
        ['name', 'amount'],
        ['中文工作簿', 123],
        ['末尾', 2048],
      ]),
      'data',
    );
    const bytes = new Uint8Array(write(book, { type: 'array', bookType: 'dbf', codepage: 936 }));
    const sheets = await readLegacyWorkbook(bytes);
    expect(sheets[0].rows[1]).toEqual(['中文工作簿', '123']);
    expect(sheets[0].rows[2]).toEqual(['末尾', '2048']);
  });
  it.each(['biff8', 'xlsb'] as const)(
    'reads %s Unicode cells, multiple sheets, and complete rows',
    async (bookType) => {
      const book = utils.book_new();
      const rows = [['姓名', '金额'], ...Array.from({ length: 3100 }, (_, i) => [`中文 ${i}`, i])];
      utils.book_append_sheet(book, utils.aoa_to_sheet(rows), '中文表');
      utils.book_append_sheet(book, utils.aoa_to_sheet([['第二张表']]), 'Sheet 2');
      const data = write(book, { type: 'array', bookType });
      const sheets = await readLegacyWorkbook(new Uint8Array(data));
      expect(sheets.map((sheet) => sheet.name)).toEqual(['中文表', 'Sheet 2']);
      expect(sheets[0].rows).toHaveLength(3101);
      expect(sheets[0].rows.at(-1)).toEqual(['中文 3099', '3099']);
      expect(sheets[0].truncated).toBe(false);
    },
  );
});
