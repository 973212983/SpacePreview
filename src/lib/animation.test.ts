import { describe, expect, it } from 'vitest';
import { strToU8, gzipSync, zipSync } from 'fflate';
import { readAnimation } from './animation';
const animation = { v: '5.7.4', fr: 30, w: 100, h: 100, ip: 0, op: 60, layers: [], assets: [] };
describe('animation container decoding', () => {
  it('reads TGS and multiple dotLottie animations with local images', () => {
    const tgs = readAnimation(gzipSync(strToU8(JSON.stringify(animation))), 'sample.tgs');
    expect(tgs.data.fr).toBe(30);
    const bytes = zipSync({
      'manifest.json': strToU8(JSON.stringify({ animations: [{ id: 'one' }, { id: 'two' }] })),
      'animations/one.json': strToU8(JSON.stringify(animation)),
      'animations/two.json': strToU8(
        JSON.stringify({ ...animation, assets: [{ id: 'img', u: 'images/', p: 'sample.png' }] }),
      ),
      'images/sample.png': new Uint8Array([1, 2, 3]),
    });
    const result = readAnimation(bytes, 'sample.lottie', 1);
    expect(result.names).toEqual(['one', 'two']);
    expect(result.data.assets).toEqual([
      { id: 'img', u: '', p: 'data:image/png;base64,AQID', e: 1 },
    ]);
    expect(() => readAnimation(bytes, 'sample.lottie', 4)).toThrow('页码');
  });
  it('removes remote image and font locations and rejects invalid animation data', () => {
    const bytes = strToU8(
      JSON.stringify({
        ...animation,
        assets: [{ u: 'https://example.invalid/', p: 'tracker.png' }],
        fonts: { list: [{ fPath: 'https://example.invalid/font', fOrigin: 'g' }] },
      }),
    );
    const result = readAnimation(bytes, 'sample.lottie.json');
    expect(result.data.assets).toEqual([{ u: '', p: '', e: 1 }]);
    expect(result.data.fonts).toEqual({ list: [{ fOrigin: 'n' }] });
    expect(() => readAnimation(strToU8('{}'), 'sample.lottie.json')).toThrow('有效');
  });
});
