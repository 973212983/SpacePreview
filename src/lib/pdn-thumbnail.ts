import { XMLParser } from 'fast-xml-parser';

export function pdnThumbnail(bytes: Uint8Array) {
  const xml = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('PDN XML 包含外部实体。');
  const parsed = new XMLParser({ ignoreAttributes: false, processEntities: false }).parse(xml);
  const png = parsed?.pdnImage?.custom?.thumb?.['@_png'];
  if (typeof png !== 'string' || !/^[A-Za-z0-9+/=\s]+$/.test(png))
    throw new Error('PDN 文件没有内置 PNG 预览图。');
  const data = Uint8Array.from(atob(png.replace(/\s/g, '')), (char) => char.charCodeAt(0));
  if (data.length < 8 || data[0] !== 137 || new TextDecoder().decode(data.slice(1, 4)) !== 'PNG')
    throw new Error('PDN 预览图签名无效。');
  return data;
}
