export function iconFrames(bytes: Uint8Array, kind: 'icns' | 'ani') {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number) => new TextDecoder().decode(bytes.subarray(offset, offset + 4));
  const frames: { bytes: Uint8Array; format: string; rank: number }[] = [];
  if (kind === 'icns') {
    if (bytes.length < 8 || tag(0) !== 'icns' || view.getUint32(4) > bytes.length)
      throw new Error('ICNS 文件头无效。');
    const end = view.getUint32(4);
    for (let offset = 8; offset < end;) {
      if (offset + 8 > end) throw new Error('ICNS 图块已截断。');
      const size = view.getUint32(offset + 4);
      if (size < 8 || offset + size > end) throw new Error('ICNS 图块大小无效。');
      const data = bytes.slice(offset + 8, offset + size);
      if (data[0] === 137 && tag(offset + 9) === 'PNG\r') {
        if (data.length < 24) throw new Error('ICNS PNG 图块已截断。');
        frames.push({ bytes: data, format: 'PNG', rank: new DataView(data.buffer).getUint32(16) });
      } else if (data[0] === 0 && data[1] === 0 && data[2] === 0 && data[3] === 12) {
        frames.push({ bytes: data, format: 'JP2', rank: size });
      }
      offset += size;
    }
    frames.sort((a, b) => b.rank - a.rank);
  } else {
    if (
      bytes.length < 12 ||
      tag(0) !== 'RIFF' ||
      tag(8) !== 'ACON' ||
      view.getUint32(4, true) + 8 > bytes.length
    )
      throw new Error('ANI 文件头无效。');
    const scan = (start: number, end: number, depth = 0) => {
      if (depth > 16) throw new Error('ANI 目录嵌套过深。');
      for (let offset = start; offset < end;) {
        if (offset + 8 > end) throw new Error('ANI 图块已截断。');
        const size = view.getUint32(offset + 4, true),
          finish = offset + 8 + size;
        if (finish > end) throw new Error('ANI 图块大小无效。');
        if (tag(offset) === 'LIST' && size >= 4 && tag(offset + 8) === 'fram')
          scan(offset + 12, finish, depth + 1);
        else if (tag(offset) === 'icon' && size >= 4)
          frames.push({
            bytes: bytes.slice(offset + 8, finish),
            format: view.getUint16(offset + 10, true) === 2 ? 'CUR' : 'ICO',
            rank: 0,
          });
        if (frames.length > 4096) throw new Error('图标帧数超过 4096。');
        offset = finish + (size & 1);
      }
    };
    scan(12, view.getUint32(4, true) + 8);
  }
  if (!frames.length)
    throw new Error(
      kind === 'icns'
        ? '此 ICNS 没有 PNG/JPEG 2000 图块，旧版位图图标暂不支持。'
        : 'ANI 没有可解码的图标帧。',
    );
  return frames;
}
