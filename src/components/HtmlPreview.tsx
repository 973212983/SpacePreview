import PreviewToolbar from './PreviewToolbar';
import { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { decodeHtml } from '../lib/html';
import { forwardPreviewKey } from '../lib/shortcuts';
import type { PreviewFile } from '../lib/files';
import { readFullBytes, readRange } from '../lib/bridge';
import { readInStages } from '../lib/progressive-read';
import DocumentReader from './DocumentReader';
import { TextAppearanceControls, useTextAppearance } from './TextAppearance';
import { forwardPreviewWheel } from '../lib/preview-gestures';

export default function HtmlPreview({ file }: { file: PreviewFile }) {
  const { size, font } = useTextAppearance();
  const [html, setHtml] = useState('');
  const [encoding, setEncoding] = useState('');
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const scrollPosition = useRef(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const applyAppearance = () => {
    const doc = frame.current?.contentDocument;
    if (!doc?.body) return;
    let style = doc.getElementById('preview-text-appearance');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'preview-text-appearance';
      doc.head.append(style);
    }
    const family =
      font === 'auto'
        ? ''
        : getComputedStyle(frame.current!).getPropertyValue('--preview-font-family');
    // Scale authored heading/paragraph sizes together; only an explicit font
    // choice overrides the webpage's font declarations.
    style.textContent = `body{font-size:16px!important} ${family ? `body,body *{font-family:${family}!important}` : ''}`;
    doc.body.style.zoom = String(size / 16);
  };
  useEffect(applyAppearance, [size, font, html, reading]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setHtml('');
    setError('');
    setProgress(0);
    setLoading(true);
    scrollPosition.current = 0;
    const publish = async (bytes: Uint8Array, complete = true) => {
      controller.signal.throwIfAborted();
      const decoded = decodeHtml(bytes, 'auto', !complete);
      const safe = DOMPurify.sanitize(decoded.text, {
        WHOLE_DOCUMENT: true,
        ADD_TAGS: ['style'],
        FORBID_TAGS: [
          'script',
          'iframe',
          'object',
          'embed',
          'base',
          'meta',
          'link',
          'form',
          'audio',
          'video',
        ],
      });
      const doc = new DOMParser().parseFromString(safe, 'text/html');
      doc.querySelectorAll('[href]').forEach((node) => {
        if (!node.getAttribute('href')?.startsWith('#')) node.removeAttribute('href');
      });
      doc.querySelectorAll('[src]').forEach((node) => {
        if (!/^data:image\/(png|jpeg|gif|webp);base64,/i.test(node.getAttribute('src') || ''))
          node.removeAttribute('src');
      });
      doc.querySelectorAll('[srcset]').forEach((node) => node.removeAttribute('srcset'));
      doc.querySelectorAll<HTMLInputElement>('input,textarea,select,button').forEach((node) => {
        node.disabled = true;
      });
      doc
        .querySelectorAll('[contenteditable]')
        .forEach((node) => node.removeAttribute('contenteditable'));
      const policy = doc.createElement('meta');
      policy.httpEquiv = 'Content-Security-Policy';
      policy.content =
        "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'";
      doc.head.prepend(policy);
      const scrollStyle = doc.createElement('style');
      scrollStyle.textContent =
        'html,*{scrollbar-width:thin;scrollbar-color:#aab4c4 transparent}@supports selector(::-webkit-scrollbar){html,*{scrollbar-width:auto}}::-webkit-scrollbar{width:5px!important;height:5px!important}::-webkit-scrollbar-thumb{background:#aab4c4!important;border:1px solid transparent!important;background-clip:padding-box!important;border-radius:8px!important}::-webkit-scrollbar-thumb:hover{background:#798698!important}::-webkit-scrollbar-track{background:transparent!important}';
      doc.head.append(scrollStyle);
      if (active) {
        scrollPosition.current =
          frame.current?.contentDocument?.scrollingElement?.scrollTop ?? scrollPosition.current;
        setHtml('<!doctype html>' + doc.documentElement.outerHTML);
        setEncoding(decoded.encoding);
      }
    };
    void (
      file.size > 512 * 1024
        ? readInStages(
            file.size,
            (offset, length) => readRange(file, offset, length),
            controller.signal,
            publish,
            setProgress,
          )
        : readFullBytes(file, controller.signal, setProgress).then((bytes) => publish(bytes))
    )
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [file]);
  const tools = (
    <>
      <span className="reading-label">HTML · {encoding}</span>
      <button title="不执行脚本或加载外部资源" onClick={() => setReading(!reading)}>
        {reading ? '网页预览' : '阅读模式'}
      </button>
    </>
  );
  const status = html && (loading || error) && (
    <div className="progressive-status" role={error ? 'alert' : 'status'}>
      {error ? `后续内容加载失败：${error}` : `后续网页内容加载中… ${progress}%`}
    </div>
  );
  if (reading)
    return (
      <>
        {status}
        <DocumentReader html={html} toolbar={tools} />
      </>
    );
  return (
    <div className="html-preview">
      {status}
      <TextAppearanceControls />
      <PreviewToolbar className="content-toolbar">{tools}</PreviewToolbar>
      {error && !html ? (
        <p className="preview-message" role="alert">
          {error}
        </p>
      ) : !html ? (
        <div className="preview-message" role="status">
          <span className="spinner" />
          <p>{progress < 100 ? `正在加载完整网页… ${progress}%` : '正在准备完整网页…'}</p>
        </div>
      ) : (
        <iframe
          ref={frame}
          title="HTML 网页预览"
          sandbox="allow-same-origin"
          srcDoc={html}
          onLoad={() => {
            const doc = frame.current?.contentDocument;
            if (!doc) return;
            doc.addEventListener('keydown', forwardPreviewKey);
            doc.addEventListener('keyup', forwardPreviewKey);
            doc.addEventListener('wheel', forwardPreviewWheel, { passive: false });
            applyAppearance();
            if (doc.scrollingElement) doc.scrollingElement.scrollTop = scrollPosition.current;
          }}
        />
      )}
    </div>
  );
}
