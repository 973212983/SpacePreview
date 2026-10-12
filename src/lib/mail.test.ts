import { describe, expect, it } from 'vitest';
import { readMail } from './mail';

describe('mail content decoding', () => {
  it('decodes MIME header words, legacy body encoding and attachment bytes', async () => {
    const text = [
      'From: Alice <alice@example.test>',
      'To: Bob <bob@example.test>',
      'Subject: =?UTF-8?B?5Lit5paH?=',
      'MIME-Version: 1.0',
      'Content-Type: multipart/mixed; boundary=preview',
      '',
      '--preview',
      'Content-Type: text/plain; charset=gb18030',
      'Content-Transfer-Encoding: base64',
      '',
      '1tDOxA==',
      '--preview',
      'Content-Type: application/octet-stream',
      'Content-Disposition: attachment; filename=picture.png',
      'Content-Transfer-Encoding: base64',
      '',
      'AQIDBA==',
      '--preview--',
      '',
    ].join('\r\n');
    const mail = await readMail(new TextEncoder().encode(text), 'sample.eml');
    expect(mail.subject).toBe('中文');
    expect(mail.text?.trim()).toBe('中文');
    expect(mail.from).toContain('alice@example.test');
    expect(mail.attachments[0].name).toBe('picture.png');
    expect(mail.attachments[0].data).toEqual(new Uint8Array([1, 2, 3, 4]));
  });
  it('rejects invalid MSG instead of displaying binary as text', async () => {
    await expect(
      readMail(new TextEncoder().encode('not Outlook'), 'invalid.msg'),
    ).rejects.toThrow();
  });
});
