import { describe, expect, it } from 'vitest';
import { previewWindowSize } from './preview-window';

describe('content-sized preview windows', () => {
  it('fits portrait video without a wide empty window', () => {
    const size = previewWindowSize(1080, 1920, 1440, 900)!;
    expect(size.height).toBe(852);
    expect(size.width).toBe(455);
    expect(Math.abs(size.width / (size.height - 44) - 1080 / 1920)).toBeLessThan(0.002);
  });
  it('fits landscape content and keeps controls usable for tiny images', () => {
    expect(previewWindowSize(3840, 2160, 1440, 900)).toEqual({ width: 1392, height: 827 });
    expect(previewWindowSize(16, 16, 1440, 900)).toEqual({ width: 320, height: 240 });
  });
  it('keeps a normal reading viewport and bounds it on smaller screens', () => {
    expect(previewWindowSize(1000, 716, 1440, 900, false)).toEqual({ width: 1000, height: 760 });
    expect(previewWindowSize(1000, 716, 900, 700, false)).toEqual({ width: 852, height: 652 });
  });
  it('ignores unavailable metadata', () => {
    for (const value of [0, -1, NaN, Infinity])
      expect(previewWindowSize(value, 100, 1440, 900)).toBeNull();
  });
});
