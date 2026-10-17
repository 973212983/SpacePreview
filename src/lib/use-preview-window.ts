import { useEffect } from 'react';
import { currentMonitor, getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { previewWindowSize } from './preview-window';

// Measure once after each preview loads; subsequent scrolling/zooming must not resize the window.
export function usePreviewWindow(enabled: boolean, identity: string, settingsOpen: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let finished = false;
    let timer: ReturnType<typeof setTimeout>;
    const resize = async (width: number, height: number, proportional: boolean) => {
      if (finished) return;
      finished = true;
      const win = getCurrentWindow();
      try {
        const monitor = await currentMonitor();
        if (!monitor || cancelled || (await win.isMaximized()) || (await win.isFullscreen()))
          return;
        const area = monitor.workArea.size.toLogical(monitor.scaleFactor);
        const size = previewWindowSize(width, height, area.width, area.height, proportional);
        if (!size || cancelled) return;
        await win.setSize(new LogicalSize(size.width, size.height));
        if (!cancelled) await win.center();
      } catch (error) {
        console.warn('Preview window sizing failed', error);
      }
    };
    const measure = () => {
      if (finished || cancelled) return;
      if (settingsOpen || !identity) {
        void resize(840, 640, false);
        return;
      }
      const root = document.querySelector('.preview-layer:not([hidden])');
      if (!root) return;
      const video = root.querySelector('video');
      if (video) {
        if (video.videoWidth) void resize(video.videoWidth, video.videoHeight, true);
        return;
      }
      const image = root.querySelector<HTMLImageElement>('.preview-image');
      if (image) {
        if (image.naturalWidth) void resize(image.naturalWidth, image.naturalHeight, true);
        return;
      }
      const pdf = root.querySelector<HTMLElement>('[data-page-width][data-rendered="true"]');
      if (pdf) {
        void resize(Number(pdf.dataset.pageWidth) + 48, Number(pdf.dataset.pageHeight) + 48, true);
        return;
      }
      const frame = root.querySelector<HTMLIFrameElement>('.word-frame');
      const page = frame?.contentDocument?.querySelector<HTMLElement>('.docx, .rtf-page');
      if (page) {
        void resize(page.offsetWidth + 32, page.offsetHeight + 32, true);
        return;
      }
      const content = root.querySelector<HTMLElement>(
        'pre, .workbook-table, .document-paper, .slide-paper, .archive-list, .directory-tree, .audio-preview, .file-info, .preview-message',
      );
      if (root.querySelector('.pdf-preview') && !pdf) return;
      if (!content) {
        if (!root.querySelector('.spinner, .word-status')) void resize(900, 640, false);
        return;
      }
      if (content.querySelector('.spinner')) return;
      if (content.matches('.document-paper, .slide-paper')) {
        // Measure prose at a readable width, independent of the previous media window.
        const clone = content.cloneNode(true) as HTMLElement;
        Object.assign(clone.style, {
          position: 'fixed',
          left: '-10000px',
          top: '0',
          width: '760px',
          maxWidth: 'none',
          height: 'auto',
          minHeight: '0',
          visibility: 'hidden',
        });
        content.parentElement!.appendChild(clone);
        const height = clone.scrollHeight;
        clone.remove();
        void resize(800, height + 40, false);
        return;
      }
      if (content.matches('pre')) {
        let width = 0;
        for (const code of content.querySelectorAll('code')) {
          const text = document.createRange();
          text.selectNodeContents(code);
          width = Math.max(width, text.getBoundingClientRect().width);
        }
        void resize(width + 100, content.scrollHeight + 32, false);
        return;
      }
      const range = document.createRange();
      range.selectNodeContents(content);
      const bounds = range.getBoundingClientRect();
      if (bounds.width && bounds.height) void resize(bounds.width + 80, bounds.height + 64, false);
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(measure, 150);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.querySelector('.preview-container') ?? document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-rendered'],
    });
    document.addEventListener('load', schedule, true);
    document.addEventListener('loadedmetadata', schedule, true);
    // Word renders inside its own document; observe it after the frame loads.
    let frameObserver: MutationObserver | undefined;
    const observeFrame = () => {
      const body = document.querySelector<HTMLIFrameElement>('.word-frame')?.contentDocument?.body;
      if (body && !frameObserver) {
        frameObserver = new MutationObserver(schedule);
        frameObserver.observe(body, {
          childList: true,
          subtree: true,
        });
      }
      schedule();
    };
    document.addEventListener('load', observeFrame, true);
    observeFrame();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      observer.disconnect();
      frameObserver?.disconnect();
      document.removeEventListener('load', schedule, true);
      document.removeEventListener('loadedmetadata', schedule, true);
      document.removeEventListener('load', observeFrame, true);
    };
  }, [enabled, identity, settingsOpen]);
}
