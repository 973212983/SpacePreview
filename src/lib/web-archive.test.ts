import { describe, expect, it } from 'vitest';
import { readWebArchive } from './web-archive';

describe('MHTML MIME decoding', () => {
  it('preserves legacy Chinese charset and Content-Location resources', async () => {
    const source = [
      'MIME-Version: 1.0',
      'Content-Type: multipart/related; boundary=web',
      '',
      '--web',
      'Content-Type: text/html; charset=gb18030',
      'Content-Location: https://example.test/page.html',
      'Content-Transfer-Encoding: base64',
      '',
      'PGgxPtbQzsQ8L2gxPg==',
      '--web',
      'Content-Type: image/png',
      'Content-Location: https://example.test/picture.png',
      'Content-Transfer-Encoding: base64',
      '',
      'AQIDBA==',
      '--web--',
      '',
    ].join('\r\n');
    const archive = await readWebArchive(new TextEncoder().encode(source));
    expect(archive.html.trim()).toBe('<h1>中文</h1>');
    expect(archive.location).toBe('https://example.test/page.html');
    expect(archive.resources[0]).toEqual({
      location: 'https://example.test/picture.png',
      mime: 'image/png',
      bytes: new Uint8Array([1, 2, 3, 4]),
    });
  });
  it('reports files without an HTML document', async () => {
    await expect(
      readWebArchive(new TextEncoder().encode('Content-Type: text/plain\r\n\r\nhello')),
    ).rejects.toThrow('HTML');
  });
});
