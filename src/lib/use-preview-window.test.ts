import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  cleanup: undefined as undefined | (() => void),
  win: {
    setSize: vi.fn(),
    center: vi.fn(),
    show: vi.fn(),
    setFocus: vi.fn(),
    isVisible: vi.fn(async () => false),
    isMaximized: vi.fn(async () => false),
    isFullscreen: vi.fn(async () => false),
  },
}));
vi.mock('react', () => ({
  useEffect: (effect: () => (() => void) | undefined) => {
    state.cleanup = effect();
  },
}));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => state.win,
  currentMonitor: async () => ({
    scaleFactor: 1,
    workArea: { size: { toLogical: () => ({ width: 1440, height: 900 }) } },
  }),
  LogicalSize: class {
    constructor(
      public width: number,
      public height: number,
    ) {}
  },
}));
import { usePreviewWindow } from './use-preview-window';
function setup() {
  vi.stubGlobal('document', {
    body: {},
    querySelector: () => null,
    addEventListener() {},
    removeEventListener() {},
  });
  vi.stubGlobal(
    'MutationObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
}
afterEach(() => {
  state.cleanup?.();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
it('resets the home size without reopening a closed preview', async () => {
  setup();
  usePreviewWindow(true, '', false, 'text');
  await vi.waitFor(() => expect(state.win.center).toHaveBeenCalledOnce());
  expect(state.win.setSize).toHaveBeenCalledWith({ width: 720, height: 480 });
  expect(state.win.show).not.toHaveBeenCalled();
});
it('uses an independent settings size and reveals settings when requested', async () => {
  setup();
  usePreviewWindow(true, 'previous-portrait', true, 'image');
  await vi.waitFor(() => expect(state.win.show).toHaveBeenCalledOnce());
  expect(state.win.setSize).toHaveBeenCalledWith({ width: 900, height: 660 });
});

it('does not resize or reveal Windows windows when macOS sizing is disabled', () => {
  usePreviewWindow(false, 'portrait-image', false, 'image');
  expect(state.win.setSize).not.toHaveBeenCalled();
  expect(state.win.show).not.toHaveBeenCalled();
});
