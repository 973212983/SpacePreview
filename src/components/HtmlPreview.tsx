import PreviewToolbar from './PreviewToolbar';
import { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { decodeHtml } from '../lib/html';
import { forwardPreviewKey } from '../lib/shortcuts';
import type { PreviewFile } from '../lib/files';
import { readFullBytes } from '../lib/bridge';
import DocumentReader from './DocumentReader';

export default function HtmlPreview({
  file,
  onSource,
}: {
  file: PreviewFile;
  onSource: () => void;
}) {
  const [html, setHtml] = useState('');
  const [encoding, setEncoding] = useState('');
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setHtml('');
    setError('');
    setProgress(0);
    void readFullBytes(file, controller.signal, setProgress)
      .then((bytes) => {
        const decoded = decodeHtml(bytes);
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
          setHtml('<!doctype html>' + doc.documentElement.outerHTML);
          setEncoding(decoded.encoding);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
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
      <button title="动态网页可查看源码" onClick={onSource}>
        查看源码
      </button>
    </>
  );
  if (reading) return <DocumentReader html={html} toolbar={tools} />;
  return (
    <div className="html-preview">
      <PreviewToolbar className="content-toolbar">{tools}</PreviewToolbar>
      {error ? (
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
          }}
        />
      )}
    </div>
  );
}
