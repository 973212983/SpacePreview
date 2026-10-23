import { describe, expect, it } from 'vitest';
import { documentError } from './document-error';

describe('document load errors', () => {
  it('does not report a network or module loading error as file corruption', () => {
    expect(documentError('PDF', new TypeError('Failed to fetch'))).toBe(
      'PDF 加载失败：Failed to fetch',
    );
    expect(documentError('Word', new Error('Failed to fetch dynamically imported module'))).toBe(
      'Word 加载失败：Failed to fetch dynamically imported module',
    );
  });

  it('identifies password protection and invalid PDF content from engine errors', () => {
    expect(
      documentError('PDF', { name: 'PasswordException', message: 'No password given' }),
    ).toContain('需要密码');
    expect(
      documentError('PDF', { name: 'InvalidPDFException', message: 'Invalid PDF structure.' }),
    ).toBe('PDF 内容无效或结构损坏：Invalid PDF structure.');
  });

  it('retains native read failures returned as strings', () => {
    expect(documentError('Word', 'Access is denied')).toBe('Word 加载失败：Access is denied');
    expect(documentError('RTF', null)).toContain('未获得具体错误信息');
  });
});
