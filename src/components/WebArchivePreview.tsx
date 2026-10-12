import { useEffect, useState } from 'react';
import type { PreviewFile } from '../lib/files';
import { readFullBytes } from '../lib/bridge';
import { parseInWorker } from '../lib/worker-client';
import { materializeWebArchive } from '../lib/web-archive';
import HtmlPreview from './HtmlPreview';

export default function WebArchivePreview({ file }: { file: PreviewFile }) {
  const [page, setPage] = useState<PreviewFile>();
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void readFullBytes(file, controller.signal)
      .then((bytes) =>
        parseInWorker({ kind: 'web-archive', name: file.name, bytes }, controller.signal),
      )
      .then((result) => {
        if (controller.signal.aborted) return;
        const blob = new Blob([materializeWebArchive(result.webArchive!)], { type: 'text/html' });
        setPage({ ...file, path: undefined, blob, size: blob.size, mime: 'text/html' });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [file]);
  return error ? (
    <p className="preview-message" role="alert">
      {error}
    </p>
  ) : page ? (
    <HtmlPreview file={page} />
  ) : (
    <div className="preview-message" role="status">
      <span className="spinner" />
      正在读取网页存档…
    </div>
  );
}
