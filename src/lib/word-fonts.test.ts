import { expect, it } from 'vitest';
import { strToU8, strFromU8 } from 'fflate';
import { resolveWordThemeFonts } from './word-fonts';

it('resolves Chinese theme fonts while preserving explicit fonts and text whitespace', () => {
  const parts = {
    'word/theme/theme1.xml': strToU8(
      '<a:theme><a:themeElements><a:fontScheme><a:minorFont><a:ea typeface=""/><a:font script="Hans" typeface="宋体"/><a:font script="Jpan" typeface="游明朝"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>',
    ),
    'word/settings.xml': strToU8('<w:settings><w:themeFontLang w:eastAsia="zh-CN"/></w:settings>'),
    'word/document.xml': strToU8(
      '<w:document><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:eastAsiaTheme="minorEastAsia"/></w:rPr><w:t xml:space="preserve">  001 &amp; 字体  </w:t></w:r><w:r><w:rPr><w:rFonts w:eastAsia="楷体"/></w:rPr></w:r><w:r><w:rPr><w:rFonts w:eastAsiaTheme="minorEastAsia"/><w:lang w:eastAsia="ja-JP"/></w:rPr></w:r></w:document>',
    ),
  };
  resolveWordThemeFonts(parts);
  const result = strFromU8(parts['word/document.xml']);
  expect(result).toContain('w:eastAsia="宋体"');
  expect(result).toContain('w:eastAsia="楷体"');
  expect(result).toContain('w:eastAsia="游明朝"');
  expect(result).toContain('w:ascii="Calibri"');
  expect(result).toContain('  001 &amp; 字体  ');
});

it('keeps unresolved themes unchanged when the document provides no language', () => {
  const parts = {
    'word/theme/theme1.xml': strToU8(
      '<a:theme><a:themeElements><a:fontScheme><a:minorFont><a:font script="Hans" typeface="宋体"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>',
    ),
    'word/document.xml': strToU8('<w:rFonts w:eastAsiaTheme="minorEastAsia"/>'),
  };
  const before = parts['word/document.xml'];
  resolveWordThemeFonts(parts);
  expect(parts['word/document.xml']).toBe(before);
});
