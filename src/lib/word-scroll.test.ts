import { afterEach, expect, it, vi } from 'vitest';
import { mountWordScroll } from './word-scroll';

afterEach(() => vi.unstubAllGlobals());

function harness() {
  let notify: (entries: unknown[]) => void = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: typeof notify) {
        notify = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  const slots: any[] = [];
  const scrollBy = vi.fn();
  const target = {
    defaultView: { scrollBy },
    documentElement: { style: { overflowAnchor: 'auto' } },
    body: { append: (slot: unknown) => slots.push(slot) },
    createElement: () => {
      const slot = {
        dataset: {},
        style: {} as Record<string, string>,
        loaded: false,
        top: 0,
        getBoundingClientRect: () => {
          const height = slot.style.height === 'auto' ? 12000 : parseFloat(slot.style.height);
          return { top: slot.top, height, bottom: slot.top + height };
        },
        replaceChildren: () => {
          slot.loaded = false;
        },
      };
      return slot;
    },
  } as unknown as Document;
  return {
    target,
    slots,
    scrollBy,
    disconnect,
    notify: (index: number, visible: boolean) =>
      notify([{ target: slots[index], isIntersecting: visible }]),
  };
}

it('loads on approach, releases distant DOM, and restores it when scrolling back', async () => {
  const h = harness();
  const render = vi.fn(async (_index, host: any) => {
    host.loaded = true;
  });
  mountWordScroll(h.target, 192, render, new AbortController().signal, vi.fn());
  await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(1));
  h.notify(0, false);
  h.notify(1, true);
  await vi.waitFor(() => expect(h.slots[1].loaded).toBe(true));
  expect(h.slots[0].loaded).toBe(false);
  expect(h.slots[0].style.height).toBe('12000px');
  h.notify(1, false);
  h.notify(0, true);
  await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(3));
  expect(h.slots.filter((slot) => slot.loaded)).toHaveLength(1);
});

it('compensates for a changed placeholder above the viewport', async () => {
  const h = harness();
  mountWordScroll(
    h.target,
    3,
    async (_index, host: any) => {
      host.top = -9000;
    },
    new AbortController().signal,
    vi.fn(),
  );
  await vi.waitFor(() => expect(h.scrollBy).toHaveBeenCalledWith(0, 4000));
});

it('disconnects and prevents further mounting after closing the preview', async () => {
  const h = harness();
  const controller = new AbortController();
  const render = vi.fn(async () => {});
  mountWordScroll(h.target, 192, render, controller.signal, vi.fn());
  await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(1));
  controller.abort();
  h.notify(1, true);
  expect(h.disconnect).toHaveBeenCalledOnce();
  expect(render).toHaveBeenCalledTimes(1);
});

it('owns scroll anchoring on Chromium and restores it on disposal', () => {
  const h = harness();
  const controller = new AbortController();
  mountWordScroll(h.target, 2, async () => {}, controller.signal, vi.fn());
  expect(h.target.documentElement.style.overflowAnchor).toBe('none');
  controller.abort();
  expect(h.target.documentElement.style.overflowAnchor).toBe('auto');
});
