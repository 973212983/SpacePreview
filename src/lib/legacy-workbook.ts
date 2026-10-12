import { read, utils, set_cptable } from 'xlsx';
import type { WorkbookSheet } from './worker-types';
import { decodeText, extension } from './files';
export async function readLegacyWorkbook(bytes: Uint8Array, name = ''): Promise<WorkbookSheet[]> {
  const table = await import('xlsx/dist/cpexcel.full.mjs');
  const decoders = new Map<number, TextDecoder>([
    [936, new TextDecoder('gb18030')],
    [950, new TextDecoder('big5')],
    [932, new TextDecoder('shift_jis')],
    [949, new TextDecoder('euc-kr')],
  ]);
  // DBF readers decode all fields before interpreting numeric binary values.
  // Native decoders tolerate those arbitrary bytes and preserve legacy CJK text.
  set_cptable({
    ...table,
    utils: {
      ...table.utils,
      decode(codepage: number, data: Uint8Array | number[] | string) {
        const decoder = decoders.get(codepage);
        if (!decoder) return table.utils.decode(codepage, data);
        const bytes =
          typeof data === 'string'
            ? Uint8Array.from(data, (char) => char.charCodeAt(0))
            : Uint8Array.from(data);
        return decoder.decode(bytes);
      },
    },
  });
  const text = ['dif', 'slk', 'sylk'].includes(extension(name));
  // "string" input is UTF-8 encoded again by SheetJS; DIF then reads it as
  // Latin-1. Feed the already decoded text directly to its text format readers.
  const book = read(text ? decodeText(bytes).text : bytes, {
    type: text ? 'binary' : 'array',
    dense: true,
    cellDates: false,
    WTF: true,
  });
  return book.SheetNames.map((name) => {
    const rows = utils.sheet_to_json<string[]>(book.Sheets[name], {
      header: 1,
      raw: false,
      defval: '',
    });
    const columns = rows.reduce((maximum, row) => Math.max(maximum, row.length), 0);
    return { name, rows, columns, truncated: false };
  });
}
