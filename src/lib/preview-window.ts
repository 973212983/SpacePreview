export function previewWindowSize(
  width: number,
  height: number,
  availableWidth: number,
  availableHeight: number,
  proportional = true,
) {
  const maxWidth = Math.max(320, availableWidth - 48);
  const maxHeight = Math.max(240, availableHeight - 48);
  if (![width, height].every((value) => Number.isFinite(value) && value > 0)) return null;
  const scale = proportional ? Math.min(1, maxWidth / width, (maxHeight - 44) / height) : 1;
  return {
    width: Math.round(Math.min(maxWidth, Math.max(320, width * scale))),
    height: Math.round(Math.min(maxHeight, Math.max(240, height * scale + 44))),
  };
}
