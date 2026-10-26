import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {
  parsePreviewPreferences,
  textEncodings,
  type PreviewPreferences,
} from '../lib/preview-preferences';

const Preferences = createContext<{
  preferences: PreviewPreferences;
  setPreferences: Dispatch<SetStateAction<PreviewPreferences>>;
}>({
  preferences: parsePreviewPreferences(null),
  setPreferences: () => {},
});
export function PreviewPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(() => {
    try {
      return parsePreviewPreferences(localStorage.getItem('preview-preferences'));
    } catch {
      return parsePreviewPreferences(null);
    }
  });
  useEffect(() => {
    localStorage.setItem('preview-preferences', JSON.stringify(preferences));
  }, [preferences]);
  return (
    <Preferences.Provider value={{ preferences, setPreferences }}>{children}</Preferences.Provider>
  );
}
export const usePreviewPreferences = () => useContext(Preferences);

export default function PreviewPreferencesSettings() {
  const { preferences, setPreferences } = usePreviewPreferences();
  const update = <K extends keyof PreviewPreferences>(key: K, value: PreviewPreferences[K]) =>
    setPreferences((current) => ({ ...current, [key]: value }));
  return (
    <>
      <p className="page-intro">设置自动保存，并应用到所有文件。</p>
      <h3>资源与性能</h3>
      <div className="preference-group">
        <label className="preference-row">
          <span>单个文件预览上限</span>
          <select
            aria-label="文件预览大小上限"
            value={preferences.maxPreviewMiB}
            onChange={(e) => update('maxPreviewMiB', Number(e.target.value))}
          >
            {[16, 32, 64, 128, 256, 512, 1024].map((size) => (
              <option key={size} value={size}>
                {size} MB
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="shortcut-help">
        超限文件只显示提示，可用默认应用打开。解析后的内存占用可能大于文件大小。
      </p>
      <h3>文本阅读</h3>
      <div className="preference-group">
        <label className="preference-row">
          <span>字体</span>
          <select
            aria-label="阅读字体"
            value={preferences.font}
            onChange={(e) => update('font', e.target.value as PreviewPreferences['font'])}
          >
            <option value="auto">默认字体</option>
            <option value="sans">现代字体</option>
            <option value="serif">书籍字体</option>
            <option value="mono">等宽字体</option>
          </select>
        </label>
        <label className="preference-row">
          <span>字号</span>
          <select
            aria-label="阅读字号"
            value={preferences.size}
            onChange={(e) => update('size', Number(e.target.value))}
          >
            {Array.from({ length: 31 }, (_, i) => i + 10).map((size) => (
              <option key={size} value={size}>
                {size} px
              </option>
            ))}
          </select>
        </label>
        <div className="preference-row">
          <span>自动换行</span>
          <button
            className={`switch ${preferences.wrap ? 'on' : ''}`}
            role="switch"
            aria-label="自动换行"
            aria-checked={preferences.wrap}
            onClick={() => update('wrap', !preferences.wrap)}
          >
            <span />
          </button>
        </div>
        <label className="preference-row">
          <span>默认编码</span>
          <select
            aria-label="默认文本编码"
            value={preferences.encoding}
            onChange={(e) => update('encoding', e.target.value as PreviewPreferences['encoding'])}
          >
            {textEncodings.map((value) => (
              <option key={value} value={value}>
                {value === 'auto' ? '自动识别（推荐）' : value.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="shortcut-help">
        适用于纯文本、代码和阅读视图。Word、PDF
        等保留文档原有字体。个别文件出现乱码时，可在该文件的更多菜单临时切换编码。
      </p>
      <h3>HTML 文件</h3>
      <div className="preference-group">
        <label className="preference-row">
          <span>默认视图</span>
          <select
            aria-label="HTML 默认视图"
            value={preferences.html}
            onChange={(e) => update('html', e.target.value as PreviewPreferences['html'])}
          >
            <option value="source">源码</option>
            <option value="web">网页预览</option>
          </select>
        </label>
      </div>
    </>
  );
}
