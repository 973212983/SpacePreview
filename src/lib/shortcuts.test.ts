import { describe, expect, it } from 'vitest';
import {
  defaultShortcut,
  matchesShortcut,
  shortcutFromEvent,
  shortcutLabel,
  validShortcut,
} from './shortcuts';

const event = (code: string, mods: Partial<KeyboardEvent> = {}) => ({
  code,
  key: code,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  shiftKey: false,
  isComposing: false,
  ...mods,
});

describe('preview shortcut configuration', () => {
  it('reserves application copy and zoom shortcuts on Windows and macOS', () => {
    for (const code of ['KeyO', 'KeyC', 'Equal', 'Minus']) {
      for (const mods of [{ ctrlKey: true }, { metaKey: true }]) {
        expect(shortcutFromEvent(event(code, mods))).toBeNull();
        expect(
          validShortcut({ ...defaultShortcut, code, ctrl: !!mods.ctrlKey, meta: !!mods.metaKey }),
        ).toBe(false);
      }
      expect(shortcutFromEvent(event(code, { ctrlKey: true, altKey: true }))).not.toBeNull();
    }
  });
  it('records and matches WebView2 input without a physical key code', () => {
    for (const [key, code] of [
      ['F8', 'F8'],
      ['p', 'KeyP'],
      [' ', 'Space'],
      ['8', 'Digit8'],
      [';', 'Semicolon'],
    ]) {
      const input = event('', { key });
      const shortcut = shortcutFromEvent(input)!;
      expect(shortcut.code).toBe(code);
      expect(matchesShortcut(input, shortcut)).toBe(true);
      expect(matchesShortcut(event('Unidentified', { key }), shortcut)).toBe(true);
    }
    expect(shortcutFromEvent(event('', { key: 'Process', isComposing: true }))).toBeNull();
  });
  it('migrates invalid stored shortcuts safely and reserves navigation and file selection', () => {
    for (const value of [
      null,
      {},
      { ...defaultShortcut, ctrl: 'yes' },
      { ...defaultShortcut, code: 'Escape' },
    ]) {
      expect(validShortcut(value)).toBe(false);
    }
    expect(validShortcut(defaultShortcut)).toBe(true);
    for (const code of ['Escape', 'Enter', 'ArrowRight', 'Tab', 'ShiftLeft', 'NumpadEnter']) {
      expect(shortcutFromEvent(event(code))).toBeNull();
    }
    expect(shortcutFromEvent(event('KeyO', { ctrlKey: true }))).toBeNull();
    expect(shortcutFromEvent(event('KeyO', { metaKey: true }))).toBeNull();
    expect(shortcutFromEvent(event('F8', { shiftKey: true }))).toBeNull();
    expect(shortcutFromEvent(event('KeyP', { isComposing: true }))).toBeNull();
  });

  it('accepts Windows and Mac combinations and only matches exact modifiers', () => {
    const win = shortcutFromEvent(event('KeyP', { ctrlKey: true, altKey: true }))!;
    const mac = shortcutFromEvent(event('KeyP', { metaKey: true }))!;
    expect(shortcutLabel(win)).toBe('Ctrl + Alt + P');
    expect(shortcutLabel(mac, true)).toBe('⌘ + P');
    expect(matchesShortcut(event('KeyP', { ctrlKey: true, altKey: true }), win)).toBe(true);
    expect(
      matchesShortcut(event('KeyP', { ctrlKey: true, altKey: true, shiftKey: true }), win),
    ).toBe(true);
    expect(matchesShortcut(event('KeyP', { ctrlKey: true }), win)).toBe(false);
    expect(
      matchesShortcut(event('KeyP', { ctrlKey: true, altKey: true, metaKey: true }), win),
    ).toBe(false);
    expect(matchesShortcut(event('Space'), win)).toBe(false);
    expect(matchesShortcut(event('KeyP', { metaKey: true, isComposing: true }), mac)).toBe(false);
  });
});
