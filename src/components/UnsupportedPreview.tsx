import { useState } from 'react';
import { FileQuestion, ExternalLink } from 'lucide-react';
import type { PreviewFile } from '../lib/files';
import { openDefault } from '../lib/bridge';

export default function UnsupportedPreview({
  file,
  message,
  onInfo,
}: {
  file?: PreviewFile;
  message: string;
  onInfo?: () => void;
}) {
  const [error, setError] = useState('');
  return (
    <div className="preview-message unsupported-preview" role="alert">
      <FileQuestion size={52} strokeWidth={1.3} />
      <h2>暂不支持预览此项目</h2>
      {file && (
        <strong className="unsupported-name" title={file.path ?? file.name}>
          {file.name}
        </strong>
      )}
      <p>{message}</p>
      <div className="unsupported-actions">
        {file?.path && (
          <button
            onClick={() => void openDefault(file).catch((reason) => setError(String(reason)))}
          >
            <ExternalLink size={16} />
            默认应用打开
          </button>
        )}
        {onInfo && <button onClick={onInfo}>查看文件信息</button>}
      </div>
      {error && <p>{error}</p>}
    </div>
  );
}
