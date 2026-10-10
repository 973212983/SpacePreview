declare module 'mammoth/mammoth.browser' {
  export function convertToHtml(
    input: { arrayBuffer: ArrayBuffer },
    options?: unknown,
  ): Promise<{ value: string }>;
  export const images: { imgElement: (callback: () => Promise<{ src: string }>) => unknown };
}
