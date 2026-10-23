import { describe, expect, it } from 'vitest';
import { findText } from './find';

describe('file text search', () => {
  it('finds literal queries and preserves offsets across mixed case and Unicode', () => {
    expect(findText('中文 Test 中文 tEsT', 'test')).toEqual([
      { start: 3, end: 7 },
      { start: 11, end: 15 },
    ]);
    expect(findText('a+b aab a+b', 'a+b')).toEqual([
      { start: 0, end: 3 },
      { start: 8, end: 11 },
    ]);
    expect(findText('a😀b😀', '😀')).toEqual([
      { start: 1, end: 3 },
      { start: 4, end: 6 },
    ]);
    expect(findText('文档', '')).toEqual([]);
    expect(findText('文档', '不存在')).toEqual([]);
  });
});
