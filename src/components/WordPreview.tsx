import { useCallback, useEffect, useRef, useState } from 'react';
import type { PreviewFile } from '../lib/files';
import { readFullBytes } from '../lib/bridge';
import { readWordPackage } from '../lib/word-package';
import { wordDom } from '../lib/word-dom';
import { trackReadingPosition } from '../lib/reading-position';
import { buildWordOutline } from '../lib/word-outline';
import { forwardPreviewKey } from '../lib/shortcuts';
import { forwardPreviewWheel } from '../lib/preview-gestures';
import { PreviewAdjustmentIndicator, usePreviewGestures } from './TextAppearance';
import { ReadingLayout, type OutlineItem } from './DocumentReader';

export default function WordPreview({
  file,
  onText,
  format = 'docx',
}: {
  file: PreviewFile;
  onText: () => void;
  format?: 'docx' | 'rtf';
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const resourceController = useRef(new AbortController());
  useEffect(() => {
    const controller = new AbortController();
    resourceController.current = controller;
    return () => controller.abort();
  }, [file]);
  const [part, setPart] = useState(0);
  const [partCount, setPartCount] = useState(1);
  const parsed = useRef<{
    file: PreviewFile;
    doc: Awaited<ReturnType<typeof import('docx-preview').parseAsync>>;
    source: Awaited<ReturnType<typeof readWordPackage>>;
  } | null>(null);
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [status, setStatus] = useState('正在读取文档…');
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState('fit');
  const adjusting = usePreviewGestures(
    useCallback(
      (direction: number) =>
        setZoom((current) => {
          const fitted = parseFloat(
            frame.current?.contentDocument?.querySelector<HTMLElement>('section.docx')?.style
              .zoom ?? '1',
          );
          const value = current === 'fit' ? fitted : Number(current);
          return String(Math.max(0.2, Math.min(3, Number((value + direction * 0.1).toFixed(2)))));
        }),
      [],
    ),
  );
  const [rendered, setRendered] = useState(false);
  const [activeId, setActiveId] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  useEffect(() => {
    const doc = frame.current?.contentDocument;
    if (!rendered || !doc?.scrollingElement) return;
    const headings = outline.flatMap((item) => {
      const element = doc.querySelector(`.${item.id}`);
      return element ? [{ id: item.id, element }] : [];
    });
    const stopOutline = trackReadingPosition(
      doc.scrollingElement as HTMLElement,
      headings,
      setActiveId,
    );
    const pages = Array.from(doc.querySelectorAll('section.docx')).map((element, i) => ({
      id: String(i + 1),
      element,
    }));
    setPageCount(pages.length);
    const stopPages = trackReadingPosition(doc.scrollingElement as HTMLElement, pages, (id) =>
      setPage(Number(id) || 1),
    );
    return () => {
      stopOutline();
      stopPages();
    };
  }, [rendered, outline]);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const load = async () => {
      const target = frame.current?.contentDocument;
      if (!target) return;
      target.body.replaceChildren();
      target.head.querySelectorAll('style').forEach((style) => style.remove());
      setRendered(false);
      setError('');
      const style = target.createElement('style');
      style.textContent =
        'html{scrollbar-width:thin;scrollbar-color:var(--scroll-thumb) transparent} @supports selector(::-webkit-scrollbar){html{scrollbar-width:auto}} body{margin:0;font-family:Calibri,"Microsoft YaHei",sans-serif} .docx-wrapper{padding:8px;background:transparent;min-height:100vh;box-sizing:border-box} .docx-wrapper>section.docx{border-radius:12px;overflow:hidden;box-shadow:none;margin-bottom:8px} [class*="word-heading-"]{scroll-margin-top:28px} a{pointer-events:none} ::-webkit-scrollbar{width:5px;height:5px} ::-webkit-scrollbar-thumb{background:var(--scroll-thumb);border:1px solid transparent;background-clip:padding-box;border-radius:10px} ::-webkit-scrollbar-thumb:hover{background:var(--scroll-hover)} ::-webkit-scrollbar-track{background:transparent}';
      target.body.append(style);
      target.addEventListener('click', (e) => {
        if ((e.target as Element).closest('a')) e.preventDefault();
      });
      // Forward closing/navigation keys from the sandboxed document to the app.
      for (const type of ['keydown', 'keyup'] as const)
        target.addEventListener(type, forwardPreviewKey);
      target.addEventListener('wheel', forwardPreviewWheel, { passive: false });
      const headings: OutlineItem[] = [];
      let nodes: Node[];
      if (format === 'rtf') {
        const [bytes, engine] = await Promise.all([
          readFullBytes(file, controller.signal, (value) =>
            setStatus(`正在读取完整文档… ${value}%`),
          ),
          import('rtf.js'),
        ]);
        if (controller.signal.aborted) return;
        engine.RTFJS.loggingEnabled(false);
        engine.WMFJS.loggingEnabled(false);
        engine.EMFJS.loggingEnabled(false);
        const doc = new engine.RTFJS.Document(bytes.buffer as ArrayBuffer, {
          onImport: (_url, callback) => callback({ error: new Error('不加载外部资源') }),
        });
        const elements = await doc.render();
        const page = document.createElement('section');
        page.className = 'docx';
        page.style.cssText =
          'width:794px;min-height:900px;padding:56px;box-sizing:border-box;background:white;color:#222;margin:0 auto;font-family:Calibri,Microsoft YaHei,sans-serif';
        page.append(...elements);
        const wrapper = document.createElement('div');
        wrapper.className = 'docx-wrapper';
        wrapper.append(page);
        nodes = [wrapper];
      } else {
        setStatus('正在读取文档结构…');
        const engine = await import('docx-preview');
        const options = {
          useBase64URL: true,
          renderAltChunks: false,
          renderComments: false,
          ignoreLastRenderedPageBreak: true,
        };
        if (parsed.current?.file !== file) {
          const source = await readWordPackage(file, resourceController.current.signal);
          setStatus('正在解析文档结构…');
          await new Promise((resolve) => setTimeout(resolve, 0));
          controller.signal.throwIfAborted();
          const doc = await engine.parseAsync(source.data, options);
          controller.signal.throwIfAborted();
          parsed.current = { file, doc, source };
        }
        const { source, doc } = parsed.current;
        // Bound the live DOM for book-sized documents. Other sections are rendered on demand.
        const children = doc.documentPart.body.children;
        const count = children.length > 1000 ? Math.ceil(children.length / 200) : 1;
        const currentPart = Math.min(part, count - 1);
        setPartCount(count);
        const body = {
          ...doc.documentPart.body,
          children:
            count > 1 ? children.slice(currentPart * 200, (currentPart + 1) * 200) : children,
        };
        // Keep the engine's image/font decoding, but supply missing binary parts on demand.
        const originalLoad = doc._package.load.bind(doc._package);
        let failedResources = 0;
        const loadResource = async (path: string, type: string) => {
          const original = await originalLoad(path, type);
          if (original != null) return original;
          try {
            const bytes = await source.resource(path);
            if (!bytes) return null;
            return type === 'blob' ? new Blob([bytes as Uint8Array<ArrayBuffer>]) : bytes;
          } catch (reason) {
            if (controller.signal.aborted) throw reason;
            failedResources++;
            return null;
          }
        };
        headings.push(...buildWordOutline(body, doc.stylesPart?.styles ?? []));
        let mounting: Promise<void> = Promise.resolve();
        setStatus('正在还原页面排版…');
        const renderDoc = Object.assign(Object.create(Object.getPrototypeOf(doc)), doc, {
          _package: Object.assign(
            Object.create(Object.getPrototypeOf(doc._package)),
            doc._package,
            { load: loadResource },
          ),
          documentPart: Object.assign(
            Object.create(Object.getPrototypeOf(doc.documentPart)),
            doc.documentPart,
            { body },
          ),
        });
        nodes = await engine.renderDocument(renderDoc, {
          ...options,
          h: wordDom(target, (wrapper) => {
            const pages = Array.from(wrapper.children);
            wrapper.replaceChildren();
            target.body.append(wrapper);
            mounting = (async () => {
              for (let index = 0; index < pages.length; index += 2) {
                controller.signal.throwIfAborted();
                wrapper.append(...pages.slice(index, index + 2));
                setRendered(true);
                setStatus(
                  `页面已显示，正在加载后续页面与图片… ${Math.min(index + 2, pages.length)} / ${pages.length}`,
                );
                await new Promise((resolve) => setTimeout(resolve, 16));
              }
            })();
            // Cancellation is handled by the enclosing load task, including while images are pending.
            void mounting.catch(() => {});
          }),
        });
        await mounting;
        if (failedResources) setError(`${failedResources} 个图片或字体未能加载，已保留可用页面。`);
      }
      if (controller.signal.aborted) return;
      for (const node of nodes) {
        if (!target.body.contains(node) && !target.head.contains(node)) target.body.append(node);
      }
      setOutline(headings);
      setStatus('');
      setRendered(true);
    };
    void load().catch((e) => {
      if (!controller.signal.aborted) {
        setError(String(e.message ?? e));
        setStatus('');
      }
    });
    return () => controller.abort();
  }, [file, ready, format, part]);
  useEffect(() => {
    if (!rendered) return;
    const apply = () => {
      const doc = frame.current?.contentDocument;
      if (!doc || !frame.current) return;
      const theme = getComputedStyle(document.documentElement);
      doc.body.style.background = theme.getPropertyValue('--office-canvas');
      for (const name of ['--office-canvas', '--scroll-thumb', '--scroll-hover'])
        doc.documentElement.style.setProperty(name, theme.getPropertyValue(name));
      doc.querySelectorAll<HTMLElement>('section.docx').forEach((page) => {
        const width = parseFloat(getComputedStyle(page).width);
        page.style.zoom = String(
          zoom === 'fit'
            ? Math.min(1, Math.max(0.2, (frame.current!.clientWidth - 16) / width))
            : Number(zoom),
        );
      });
    };
    apply();
    const resize = new ResizeObserver(apply);
    resize.observe(frame.current!);
    const theme = new MutationObserver(apply);
    theme.observe(document.documentElement, { attributes: true });
    return () => {
      resize.disconnect();
      theme.disconnect();
    };
  }, [zoom, rendered, outline]);
  return (
    <ReadingLayout
      outline={outline}
      activeId={activeId}
      onNavigate={(id) =>
        frame.current?.contentDocument?.querySelector(`.${id}`)?.scrollIntoView({ block: 'start' })
      }
      toolbar={
        <>
          <span className="reading-label">
            {format === 'rtf' ? 'RTF · 富文本预览' : 'Word · 页面预览'}
          </span>
          {pageCount > 0 && (
            <span className="word-page-count" aria-label="文档页数">
              {page} / {pageCount} 页
            </span>
          )}
          <select aria-label="Word 缩放" value={zoom} onChange={(e) => setZoom(e.target.value)}>
            {!['fit', '0.75', '0.9', '1', '1.25', '1.5', '2'].includes(zoom) && (
              <option value={zoom}>{Math.round(Number(zoom) * 100)}%</option>
            )}
            <option value="fit">适应宽度</option>
            <option value="0.75">75%</option>
            <option value="0.9">90%</option>
            <option value="1">100%</option>
            <option value="1.25">125%</option>
            <option value="1.5">150%</option>
            <option value="2">200%</option>
          </select>
          <button onClick={onText}>文字速览</button>
        </>
      }
    >
      <PreviewAdjustmentIndicator
        visible={adjusting}
        label="缩放"
        value={`${Math.round(Number(zoom) * 100)}%`}
      />
      {(status || error) && (
        <div
          className={`word-status ${rendered ? 'word-status-progress' : ''}`}
          role={error ? 'alert' : 'status'}
        >
          {!error && <span className="spinner" />}
          {error || status}
          {error && <button onClick={onText}>尝试文字速览</button>}
        </div>
      )}
      {partCount > 1 && (
        <div className="word-segments" aria-label="长文档分段导航">
          <button disabled={part === 0 || !!status} onClick={() => setPart(part - 1)}>
            上一段
          </button>
          <span>
            分段预览 {part + 1} / {partCount}
          </span>
          <button disabled={part >= partCount - 1 || !!status} onClick={() => setPart(part + 1)}>
            下一段
          </button>
        </div>
      )}
      <iframe
        ref={frame}
        title={format === 'rtf' ? 'RTF 富文本预览' : 'Word 原样预览'}
        className="word-frame"
        sandbox="allow-same-origin"
        onLoad={() => setReady(true)}
        srcDoc={
          '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data: blob:; font-src data: blob:;"></head><body></body></html>'
        }
      />
    </ReadingLayout>
  );
}
