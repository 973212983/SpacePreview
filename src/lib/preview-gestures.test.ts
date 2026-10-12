import { describe, expect, it } from 'vitest';
import { fontKeyDirection, resizeText } from './preview-gestures';

const event = {
  key: '=',
  code: 'Equal',
  ctrlKey: true,
  metaKey: false,
  altKey: false,
  isComposing: false,
};

describe('preview typography shortcuts', () => {
  it.each([
    ['+', 'Equal', 1],
    ['=', 'Equal', 1],
    ['+', 'NumpadAdd', 1],
    ['-', 'Minus', -1],
    ['-', 'NumpadSubtract', -1],
  ])('recognizes Ctrl and Command with %s / %s', (key, code, expected) => {
    expect(fontKeyDirection({ ...event, key, code })).toBe(expected);
    expect(fontKeyDirection({ ...event, key, code, ctrlKey: false, metaKey: true })).toBe(expected);
  });

  it('ignores ordinary input, Alt/AltGr, composition and unrelated keys', () => {
    expect(fontKeyDirection({ ...event, ctrlKey: false })).toBe(0);
    expect(fontKeyDirection({ ...event, altKey: true })).toBe(0);
    expect(fontKeyDirection({ ...event, isComposing: true })).toBe(0);
    expect(fontKeyDirection({ ...event, key: 'a', code: 'KeyA' })).toBe(0);
  });

  it('changes by 2px and stays between 10 and 40px', () => {
    expect(resizeText(16, 1)).toBe(18);
    expect(resizeText(16, -1)).toBe(14);
    expect(resizeText(10, -1)).toBe(10);
    expect(resizeText(40, 1)).toBe(40);
  });
});
