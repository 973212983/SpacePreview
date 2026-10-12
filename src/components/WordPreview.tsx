import { useCallback, useEffect, useRef, useState } from 'react';
import type { PreviewFile } from '../lib/files';
import { readFullBytes } from '../lib/bridge';
import { parseInWorker } from '../lib/worker-client';
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
        const [bytes, engine] = await Promise.all([
          readFullBytes(file, controller.signal, (value) =>
            setStatus(`正在读取完整文档… ${value}%`),
          ),
          import('docx-preview'),
        ]);
        setStatus('正在解析文档与图片…');
        const verified = await parseInWorker(
          { kind: 'docx-layout', bytes, name: file.name },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        const options = {
          useBase64URL: true,
          renderAltChunks: false,
          renderComments: false,
          ignoreLastRenderedPageBreak: true,
        };
        const doc = await engine.parseAsync(verified.data, options);
        if (controller.signal.aborted) return;
        headings.push(...buildWordOutline(doc.documentPart.body, doc.stylesPart?.styles ?? []));
        setStatus('正在还原页面排版…');
        nodes = await engine.renderDocument(doc, options);
      }
      if (controller.signal.aborted) return;
      const target = frame.current?.contentDocument;
      if (!target) return;
      target.body.replaceChildren(...nodes);
      const style = target.createElement('style');
      style.textContent =
        'html{scrollbar-width:thin;scrollbar-color:var(--scroll-thumb) transparent} @supports selector(::-webkit-scrollbar){html{scrollbar-width:auto}} body{margin:0;font-family:Calibri,"Microsoft YaHei",sans-serif} .docx-wrapper{padding:24px 20px;background:transparent;min-height:100vh;box-sizing:border-box} .docx-wrapper>section.docx{box-shadow:0 2px 12px #00000018,0 0 0 1px #00000006;margin-bottom:24px} [class*="word-heading-"]{scroll-margin-top:28px} a{pointer-events:none} ::-webkit-scrollbar{width:5px;height:5px} ::-webkit-scrollbar-thumb{background:var(--scroll-thumb);border:1px solid transparent;background-clip:padding-box;border-radius:10px} ::-webkit-scrollbar-thumb:hover{background:var(--scroll-hover)} ::-webkit-scrollbar-track{background:transparent}';
      target.body.append(style);
      target.addEventListener('click', (e) => {
        if ((e.target as Element).closest('a')) e.preventDefault();
      });
      // Forward closing/navigation keys from the sandboxed document to the app.
      for (const type of ['keydown', 'keyup'] as const)
        target.addEventListener(type, forwardPreviewKey);
      target.addEventListener('wheel', forwardPreviewWheel, { passive: false });
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
  }, [file, ready, format]);
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
            ? Math.min(1, Math.max(0.2, (frame.current!.clientWidth - 40) / width))
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
  }, [zoom, rendered]);
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
        <div className="word-status" role={error ? 'alert' : 'status'}>
          {!error && <span className="spinner" />}
          {error || status}
          {error && <button onClick={onText}>尝试文字速览</button>}
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
