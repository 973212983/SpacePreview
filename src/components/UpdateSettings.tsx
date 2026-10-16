import { version } from '../../package.json';
import { desktop } from '../lib/bridge';
import { formatSize } from '../lib/files';
import type { AppUpdate } from '../lib/use-app-update';

export default function UpdateSettings({ updater }: { updater: AppUpdate }) {
  const { state, checkUpdate, installUpdate, restart } = updater;
  const busy = ['checking', 'downloading', 'installing'].includes(state.phase);
  const installable = !!state.version && ['available', 'error'].includes(state.phase);
  const progress = state.total
    ? Math.min(100, Math.round((state.downloaded / state.total) * 100))
    : undefined;
  const message = !desktop
    ? '应用内更新仅在桌面版中可用。'
    : state.phase === 'checking'
      ? '正在检查更新…'
      : state.phase === 'current'
        ? '当前已是最新版本。'
        : state.phase === 'available'
          ? `发现新版本 v${state.version}。`
          : state.phase === 'downloading'
            ? `正在下载 ${formatSize(state.downloaded)}${state.total ? ` / ${formatSize(state.total)}（${progress}%）` : ''}`
            : state.phase === 'installing'
              ? '正在校验并安装更新，请稍候…'
              : state.phase === 'installed'
                ? state.error
                  ? '更新已安装，请重启瞬览。'
                  : '更新已安装，正在重启…'
                : '启动时自动检查，发现新版后由你决定是否安装。';
  return (
    <section className="update-settings" aria-label="软件更新">
      <div className="setting-row">
        <div>
          <strong>软件更新 · v{version}</strong>
          <p role="status">{message}</p>
        </div>
        <button
          className="update-button"
          disabled={!desktop || busy || state.phase === 'installed'}
          onClick={() => void checkUpdate()}
        >
          {state.phase === 'checking' ? '检查中…' : '检查更新'}
        </button>
      </div>
      {state.error && (
        <p className="update-error" role="alert">
          {state.error}
        </p>
      )}
      {state.version && (
        <div className="update-details">
          <strong>新版本 v{state.version}</strong>
          {state.notes && (
            <details>
              <summary>更新内容</summary>
              <pre>{state.notes}</pre>
            </details>
          )}
          {state.phase === 'downloading' && (
            <progress aria-label="更新下载进度" max={100} value={progress} />
          )}
          <div className="update-actions">
            <span>安装时会关闭瞬览，完成后重新启动。</span>
            {installable && (
              <button className="update-button" onClick={() => void installUpdate()}>
                {state.phase === 'error' ? '重试下载安装' : '下载并安装'}
              </button>
            )}
            {state.phase === 'installed' && (
              <button className="update-button" onClick={() => void restart()}>
                重启瞬览
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
