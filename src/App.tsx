import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Eye,
  FileCode2,
  FileText,
  FolderOpen,
  Image,
  Info,
  Keyboard,
  Layers,
  Minus,
  Square,
  Copy,
  Monitor,
  Moon,
  MoreHorizontal,
  Settings2,
  ShieldCheck,
  Sun,
  Upload,
  X,
} from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import Preview from './components/Preview';
import { PreviewMenuTarget } from './components/PreviewToolbar';
import { desktop, inspectPath, openDefault, pickNativeFiles, siblings } from './lib/bridge';
import { detectKind, formatSize, fromBrowser, type PreviewFile } from './lib/files';
import { samples } from './lib/samples';
import {
  defaultShortcut,
  matchesShortcut,
  shortcutFromEvent,
  shortcutEventCode,
  shortcutLabel,
  validShortcut,
  type Shortcut,
} from './lib/shortcuts';

type Theme = 'system' | 'light' | 'dark';
type Settings = {
  theme: Theme;
  closeOnBlur: boolean;
  spaceEnabled: boolean;
  windowsShortcut: Shortcut;
  macosShortcut: Shortcut;
};
type AgentStatus = {
  supported: boolean;
  enabled: boolean;
  running: boolean;
  platform?: 'macos';
  accessibility?: boolean;
  automation?: boolean;
  keyboard?: boolean;
};
const trace = (stage: string) => {
  if (desktop) void invoke('trace_preview', { stage }).catch(() => {});
};
function savedSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem('space-settings') || '{}');
    return {
      theme: ['system', 'light', 'dark'].includes(s.theme) ? s.theme : 'system',
      closeOnBlur: s.closeOnBlur === true,
      spaceEnabled: s.spaceEnabled !== false,
      windowsShortcut: validShortcut(s.windowsShortcut) ? s.windowsShortcut : defaultShortcut,
      macosShortcut: validShortcut(s.macosShortcut) ? s.macosShortcut : defaultShortcut,
    };
  } catch {
    return {
      theme: 'system',
      closeOnBlur: false,
      spaceEnabled: true,
      windowsShortcut: defaultShortcut,
      macosShortcut: defaultShortcut,
    };
  }
}
const sampleDetails = [
  { label: '一份阅读灵感', category: 'MARKDOWN', icon: FileText, className: 'lilac' },
  { label: '山间，停留片刻', category: 'IMAGE', icon: Image, className: 'sage' },
  { label: '让代码清晰可读', category: 'TYPESCRIPT', icon: FileCode2, className: 'blue' },
  { label: '看看里面有什么', category: 'ARCHIVE', icon: Layers, className: 'sand' },
];

export default function App() {
  const [files, setFiles] = useState<PreviewFile[]>([]);
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<'auto' | 'text' | 'info'>('auto');
  const [settings, setSettings] = useState(savedSettings);
  const [agent, setAgent] = useState<AgentStatus | null>(null);
  const macos = agent?.platform === 'macos' || /Mac/i.test(navigator.platform);
  const fileManager = macos ? 'Finder' : '资源管理器';
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recording, setRecording] = useState<'windowsShortcut' | 'macosShortcut' | null>(null);
  const [shortcutError, setShortcutError] = useState('');
  const shortcut = macos ? settings.macosShortcut : settings.windowsShortcut;
  const previewKey = shortcutLabel(shortcut, macos);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState('');
  const [opening, setOpening] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [menuTarget, setMenuTarget] = useState<HTMLDivElement | null>(null);
  const [archiveStack, setArchiveStack] = useState<PreviewFile[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const spaceAction = useRef<{ action: 'close' | 'text' | 'choose'; version: number } | null>(null);
  const previousArchiveDepth = useRef(0);
  const file = archiveStack.at(-1) ?? files[index];
  useEffect(() => {
    if (archiveStack.length < previousArchiveDepth.current)
      document
        .querySelector<HTMLButtonElement>('.preview-layer:not([hidden]) .archive-row.selected')
        ?.focus({ preventScroll: true });
    previousArchiveDepth.current = archiveStack.length;
  }, [archiveStack.length]);
  useEffect(() => {
    if (!desktop) return;
    void invoke('set_agent_shortcut', { shortcut }).catch((error) =>
      setToast(`快捷键设置失败：${String(error)}`),
    );
    spaceAction.current = null;
  }, [shortcut]);
  useEffect(() => {
    if (!settingsOpen) {
      setRecording(null);
      setShortcutError('');
    }
  }, [settingsOpen]);
  useEffect(() => {
    if (!desktop) return;
    const window = getCurrentWindow();
    let disposed = false;
    let stop: (() => void) | undefined;
    const refresh = async () => {
      const value = await window.isMaximized();
      if (!disposed) setMaximized(value);
    };
    void refresh().catch((e) => setToast(String(e)));
    void window
      .onResized(() => void refresh().catch(() => {}))
      .then((unlisten) => {
        if (disposed) unlisten();
        else stop = unlisten;
      });
    return () => {
      disposed = true;
      stop?.();
    };
  }, []);
  const toggleMaximize = async () => {
    try {
      const window = getCurrentWindow();
      await window.toggleMaximize();
      setMaximized(await window.isMaximized());
    } catch (e) {
      setToast(`窗口调整失败：${String(e)}`);
    }
  };

  useEffect(() => {
    localStorage.setItem('space-settings', JSON.stringify(settings));
    document.documentElement.dataset.theme = settings.theme;
  }, [settings]);
  useEffect(() => {
    if (!desktop) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        await invoke('set_agent_enabled', { enabled: settings.spaceEnabled });
        const current = await invoke<AgentStatus>('agent_status');
        if (!cancelled) setAgent(current);
      } catch (error) {
        if (!cancelled) setToast(`快捷键预览初始化失败：${String(error)}`);
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [settings.spaceEnabled]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    setMenuOpen(false);
  }, [file?.id]);

  const loadFiles = useCallback(
    (incoming: PreviewFile[], initialMode: 'auto' | 'text' = 'auto') => {
      if (!incoming.length) return;
      setFiles(incoming);
      setArchiveStack([]);
      setIndex(0);
      setMode(initialMode);
      setSettingsOpen(false);
      setMenuOpen(false);
    },
    [],
  );
  const loadPaths = useCallback(
    async (paths: string[], forceText = false) => {
      const version = ++request.current;
      setOpening(true);
      try {
        const incoming = await Promise.all(paths.map(inspectPath));
        if (version !== request.current) return;
        loadFiles(incoming, forceText ? 'text' : 'auto');
        trace('loaded');
        if (incoming.length === 1) {
          const adjacent = await siblings(incoming[0]);
          if (version !== request.current) return;
          const position = adjacent.findIndex((f) => f.path === incoming[0].path);
          if (position >= 0) {
            setFiles(adjacent);
            setIndex(position);
          }
        }
      } catch (e) {
        trace('load-error');
        if (version === request.current) setToast(String(e));
      } finally {
        if (version === request.current) setOpening(false);
      }
    },
    [loadFiles],
  );

  const choose = useCallback(async () => {
    if (!desktop) {
      input.current?.click();
      return;
    }
    try {
      const selected = await pickNativeFiles();
      if (selected.length) await loadPaths(selected.map((f) => f.path!));
    } catch (e) {
      setToast(String(e));
    }
  }, [loadPaths]);
  const closePreview = useCallback(() => {
    trace('close');
    request.current++;
    setFiles([]);
    setArchiveStack([]);
    setIndex(0);
    setOpening(false);
    if (desktop) void invoke('hide_preview').catch((error) => setToast(String(error)));
  }, []);
  const navigate = useCallback(
    (direction: number) => {
      setMode('auto');
      if (archiveStack.length) {
        if (direction < 0) setArchiveStack((stack) => stack.slice(0, -1));
        return;
      }
      setIndex((i) => Math.max(0, Math.min(files.length - 1, i + direction)));
    },
    [files.length, archiveStack.length],
  );
  const openFile = useCallback(async () => {
    if (!file) return;
    if (!file.path) {
      setToast('浏览器和内置示例无法调用系统默认应用，请使用桌面版打开本地文件。');
      return;
    }
    try {
      await openDefault(file);
    } catch (e) {
      setToast(String(e));
    }
  }, [file]);
  const copyPath = async () => {
    if (!file) return;
    try {
      await navigator.clipboard.writeText(file.path ?? file.name);
      setToast(file.path ? '文件路径已复制' : '文件名已复制（浏览器不提供完整路径）');
    } catch {
      setToast('剪贴板不可用，请在桌面版中重试。');
    }
    setMenuOpen(false);
  };

  useEffect(() => {
    if (!desktop) return;
    const unlisteners: (() => void)[] = [];
    let disposed = false;
    const register = (promise: Promise<() => void>) =>
      promise.then((stop) => (disposed ? stop() : unlisteners.push(stop)));
    const filesReady = register(
      listen<{ paths: string[]; text: boolean }>('preview-files', (e) => {
        trace('received');
        void loadPaths(e.payload.paths, e.payload.text);
      }),
    );
    void register(listen<string>('agent-selection-error', (event) => setToast(event.payload)));
    void register(
      listen('preview-closed', () => {
        trace('native-close');
        request.current++;
        setFiles([]);
        setIndex(0);
        setOpening(false);
      }),
    );
    void register(
      getCurrentWindow().onDragDropEvent((event) => {
        setDragging(event.payload.type === 'over' || event.payload.type === 'enter');
        if (event.payload.type === 'drop') void loadPaths(event.payload.paths);
      }),
    );
    void filesReady
      .then(() => invoke<{ paths: string[]; text: boolean }>('initial_paths'))
      .then((initial) => {
        if (!disposed && initial.paths.length) void loadPaths(initial.paths, initial.text);
      })
      .catch((error) => {
        if (!disposed) setToast(`初始文件读取失败：${String(error)}`);
      });
    return () => {
      disposed = true;
      unlisteners.forEach((stop) => stop());
    };
  }, [loadPaths]);
  useEffect(() => {
    if (!desktop || !settings.closeOnBlur || settingsOpen || !file) return;
    let disposed = false;
    let stop: (() => void) | undefined;
    void getCurrentWindow()
      .onFocusChanged((e) => {
        if (!e.payload && !disposed) {
          const version = request.current;
          // A queued blur from hiding the previous preview must not close a new one.
          void getCurrentWindow()
            .isFocused()
            .then((focused) => {
              if (!focused && !disposed && version === request.current) {
                trace('blur-close');
                closePreview();
              }
            })
            .catch(() => {});
        }
      })
      .then((fn) => {
        if (disposed) fn();
        else stop = fn;
      });
    return () => {
      disposed = true;
      stop?.();
    };
  }, [settings.closeOnBlur, settingsOpen, file, closePreview]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (recording) {
        event.preventDefault();
        event.stopPropagation();
        if (event.repeat) return;
        if (event.key === 'Escape') {
          setRecording(null);
          setShortcutError('');
          return;
        }
        if (/^(Control|Alt|Meta|Shift)(Left|Right)$/.test(event.code)) return;
        const next = shortcutFromEvent(event);
        if (!next) {
          setShortcutError(
            '使用字母、数字、符号、F1–F12 或 Space，可组合 Ctrl / Alt / ⌘。Shift 保留为纯文本预览；Ctrl / ⌘ + O 用于选择文件。',
          );
          return;
        }
        setSettings((s) => ({ ...s, [recording]: next }));
        setRecording(null);
        setShortcutError('');
        return;
      }
      if (event.code === 'Space') trace('dom-space');
      if (event.key === 'Escape' && menuOpen) {
        event.preventDefault();
        setMenuOpen(false);
        return;
      }
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('input, textarea, select, [contenteditable="true"], audio, video')
      )
        return;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (settingsOpen) setSettingsOpen(false);
        else closePreview();
      }
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        void choose();
      }
      if (settingsOpen) return;
      if (
        matchesShortcut(event, shortcut) &&
        !(
          shortcut.code === 'Space' &&
          event.target instanceof HTMLElement &&
          event.target.closest('button')
        )
      ) {
        event.preventDefault();
        if (event.repeat) return;
        spaceAction.current = {
          action: file ? (event.shiftKey ? 'text' : 'close') : 'choose',
          version: request.current,
        };
        return;
      }
      if (!file) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        navigate(event.key === 'ArrowRight' ? 1 : -1);
      }
      if (
        event.key === 'Enter' &&
        !(event.target instanceof HTMLElement && event.target.closest('button'))
      )
        void openFile();
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        void copyPath();
      }
    };
    const cancelSpace = () => {
      spaceAction.current = null;
    };
    const keyup = (event: KeyboardEvent) => {
      if (shortcutEventCode(event) !== shortcut.code) return;
      const pending = spaceAction.current;
      cancelSpace();
      if (!pending || pending.version !== request.current) return;
      event.preventDefault();
      // Keep focus unchanged until the native hook has observed the release.
      if (pending.action === 'text') setMode((m) => (m === 'text' ? 'auto' : 'text'));
      else if (pending.action === 'close') closePreview();
      else void choose();
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', cancelSpace);
    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', cancelSpace);
    };
  });

  return (
    <div
      className={`app ${file ? 'has-preview' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!desktop) loadFiles(Array.from(e.dataTransfer.files).map(fromBrowser));
      }}
    >
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          loadFiles(Array.from(e.target.files ?? []).map(fromBrowser));
          e.target.value = '';
        }}
      />
      <header className="titlebar" data-tauri-drag-region>
        <div className="title-left">
          {file ? (
            <>
              <button
                className="app-mark mini"
                title="返回欢迎页"
                onClick={() => {
                  request.current++;
                  setFiles([]);
                  setArchiveStack([]);
                }}
              >
                <img className="brand-icon" src="/app-icon.svg" alt="瞬览" />
              </button>
              {archiveStack.length > 0 && (
                <button
                  className="archive-back-button"
                  title="返回列表 · ←"
                  onClick={() => navigate(-1)}
                >
                  <ArrowLeft size={15} /> 返回列表
                </button>
              )}
              <div className="file-title">
                <strong title={`${file.name} · ${formatSize(file.size)}`}>{file.name}</strong>
              </div>
              {!archiveStack.length && files.length > 1 && (
                <div className="file-navigation">
                  <button
                    title="上一个文件 · ←"
                    disabled={index === 0}
                    onClick={() => navigate(-1)}
                  >
                    <ArrowLeft size={14} />
                  </button>
                  <span>
                    {index + 1}/{files.length}
                  </span>
                  <button
                    title="下一个文件 · →"
                    disabled={index >= files.length - 1}
                    onClick={() => navigate(1)}
                  >
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="app-mark mini">
                <img className="brand-icon" src="/app-icon.svg" alt="瞬览" />
              </div>
              <strong className="brand">
                瞬览 <span>SpacePreview</span>
              </strong>
              <span className="version-badge">PREVIEW</span>
            </>
          )}
        </div>
        <div className="title-right">
          {file && (
            <>
              <div className="menu-container">
                <button
                  className="icon-button"
                  title="更多选项"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen(!menuOpen)}
                >
                  <MoreHorizontal size={20} />
                </button>
                {menuOpen && (
                  <>
                    <button
                      className="menu-dismiss"
                      aria-label="关闭更多选项"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div className="dropdown">
                      <div className="preview-menu-options" ref={setMenuTarget} />
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          void choose();
                        }}
                      >
                        <FolderOpen size={15} /> 选择文件
                        <kbd>{macos ? '⌘' : 'Ctrl'}+O</kbd>
                      </button>
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          void openFile();
                        }}
                      >
                        <ArrowDownToLine size={15} /> 默认应用打开 <kbd>↵</kbd>
                      </button>
                      <hr />
                      {(['auto', 'text', 'info'] as const).map((m, i) => (
                        <button
                          key={m}
                          onClick={() => {
                            setMode(m);
                            setMenuOpen(false);
                          }}
                        >
                          {[<Eye size={15} />, <FileCode2 size={15} />, <Info size={15} />][i]}
                          {['自动预览', '纯文本预览', '文件信息'][i]}
                          {mode === m && <Check size={14} />}
                        </button>
                      ))}
                      <hr />
                      <button onClick={() => void copyPath()}>
                        <ArrowDownToLine size={15} />
                        复制文件路径
                      </button>
                      <button
                        onClick={() => {
                          setSettingsOpen(true);
                          setMenuOpen(false);
                        }}
                      >
                        <Settings2 size={15} />
                        偏好设置
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
          {!file && (
            <div className="menu-container">
              <button
                className="icon-button"
                title="更多选项"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <MoreHorizontal size={20} />
              </button>
              {menuOpen && (
                <>
                  <button
                    className="menu-dismiss"
                    aria-label="关闭更多选项"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="dropdown">
                    <button
                      onClick={() => {
                        setSettingsOpen(true);
                        setMenuOpen(false);
                      }}
                    >
                      <Settings2 size={15} /> 偏好设置
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          {desktop && (
            <>
              <button
                className="icon-button"
                title="最小化"
                onClick={() => void getCurrentWindow().minimize()}
              >
                <Minus size={18} />
              </button>
              <button
                className="icon-button"
                title={maximized ? '恢复窗口' : '最大化'}
                aria-label={maximized ? '恢复窗口' : '最大化'}
                onClick={() => void toggleMaximize()}
              >
                {maximized ? <Copy size={15} /> : <Square size={15} />}
              </button>
            </>
          )}
          <button
            className="icon-button close-button"
            title={file ? '关闭预览 · Esc' : '隐藏窗口'}
            onClick={closePreview}
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {file ? (
        <main
          className={`preview-container kind-${mode === 'auto' ? detectKind(file.name) : mode}`}
        >
          {[files[index], ...archiveStack].map((item, depth) => (
            <div className="preview-layer" hidden={depth !== archiveStack.length} key={item.id}>
              <PreviewMenuTarget.Provider value={depth === archiveStack.length ? menuTarget : null}>
                <Preview
                  key={`${item.id}:${depth === archiveStack.length ? mode : 'auto'}`}
                  file={item}
                  mode={depth === archiveStack.length ? mode : 'auto'}
                  onOpen={(inside) => {
                    request.current++;
                    setArchiveStack((stack) => [...stack.slice(0, depth), inside]);
                    setMode('auto');
                  }}
                />
              </PreviewMenuTarget.Provider>
            </div>
          ))}
        </main>
      ) : (
        <main className="welcome">
          <div className="welcome-topline">
            <span>
              <span className="status-dot" /> 为每一次好奇，准备就绪
            </span>
            <span className="platform-chip">
              <Monitor size={13} />
              {desktop
                ? agent?.running && agent.enabled
                  ? `${previewKey} 预览已就绪`
                  : macos && agent?.enabled
                    ? 'Finder 预览待授权'
                    : '桌面预览'
                : '浏览器体验版'}
            </span>
          </div>
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow">LESS OPENING. MORE SEEING.</div>
              <h1>
                不必打开，
                <br />
                看一眼<span className="heading-dot">就好。</span>
              </h1>
              <p>
                图片、文档、代码，还有那些不认识的文件。
                <br />
                轻按 {previewKey}，让内容即刻呈现。
              </p>
              <div className="hero-actions">
                <button className="primary-button" onClick={() => void choose()}>
                  <FolderOpen size={17} />
                  选择文件 <span>{macos ? '⌘ O' : 'Ctrl O'}</span>
                </button>
                <span className="drop-hint">或拖拽文件到这里</span>
              </div>
              <div className="privacy-line">
                <ShieldCheck size={13} /> 文件留在本地，安心看一眼。
              </div>
            </div>
            <div className="space-illustration" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="floating-file file-back">
                <FileCode2 size={28} />
                <span>TS</span>
              </div>
              <div className="floating-file file-front">
                <Image size={28} />
                <span>IMG</span>
              </div>
              <div className="space-key">
                <span>{previewKey}</span>
                <span className="space-symbol">⎵</span>
              </div>
              <div className="key-caption">一键，直达内容</div>
              <div className="spark spark-one">+</div>
              <div className="spark spark-two">+</div>
            </div>
          </section>
          <section className="samples-section">
            <div className="section-heading">
              <h2>先看一眼</h2>
              <span>
                用几个小文件，认识瞬览 <ChevronDown size={13} />
              </span>
            </div>
            <div className="sample-grid">
              {sampleDetails.map((sample, i) => (
                <button
                  key={sample.category}
                  className="sample-card"
                  onClick={() => {
                    loadFiles(samples);
                    setIndex(i);
                  }}
                >
                  <div className={`sample-art ${sample.className}`}>
                    <sample.icon size={29} strokeWidth={1.5} />
                    <span>{sample.category}</span>
                    <div className="sample-peek">
                      <Eye size={15} />
                    </div>
                  </div>
                  <div className="sample-label">
                    <strong>{sample.label}</strong>
                    <span>{samples[i].name}</span>
                    <ArrowRight size={16} />
                  </div>
                </button>
              ))}
            </div>
          </section>
          <div className="welcome-bottom">
            <div>
              <Keyboard size={16} />
              <span>少一步打开，多一点专注。</span>
            </div>
            <button onClick={() => setSettingsOpen(true)}>
              认识快捷键 <ArrowRight size={14} />
            </button>
          </div>
        </main>
      )}
      {!file && (
        <footer className="home-footer">
          <span>
            <span className="status-dot muted" /> 全部在本地发生
          </span>
          <span>
            SPACEPREVIEW <b>·</b> v0.9.13
          </span>
          <span>为「只想看一眼」而设计</span>
        </footer>
      )}

      {settingsOpen && (
        <div className="modal-overlay" onClick={() => setSettingsOpen(false)}>
          <section
            className="settings-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dialog-header">
              <div>
                <span className="eyebrow">MAKE IT YOURS</span>
                <h2 id="settings-title">偏好设置</h2>
              </div>
              <button
                autoFocus
                className="icon-button"
                title="关闭设置"
                onClick={() => setSettingsOpen(false)}
              >
                <X size={19} />
              </button>
            </div>
            <h3>外观</h3>
            <div className="theme-options">
              {(['system', 'light', 'dark'] as const).map((theme, i) => (
                <button
                  key={theme}
                  className={settings.theme === theme ? 'selected' : ''}
                  onClick={() => setSettings((s) => ({ ...s, theme }))}
                >
                  {[<Monitor size={18} />, <Sun size={18} />, <Moon size={18} />][i]}
                  {['跟随系统', '浅色', '深色'][i]}
                </button>
              ))}
            </div>
            <div className="setting-row">
              <div>
                <strong>失去焦点时关闭</strong>
                <p>{desktop ? '切换到其他应用时隐藏预览窗口' : '仅在桌面版中生效'}</p>
              </div>
              <button
                role="switch"
                aria-checked={settings.closeOnBlur}
                aria-label="失去焦点时关闭"
                disabled={!desktop}
                className={`switch ${settings.closeOnBlur ? 'on' : ''}`}
                onClick={() => setSettings((s) => ({ ...s, closeOnBlur: !s.closeOnBlur }))}
              >
                <span />
              </button>
            </div>
            {desktop && agent?.supported && (
              <div className="setting-row">
                <div>
                  <strong>{fileManager} 快捷键预览</strong>
                  <p>
                    {agent.running
                      ? `原生监听已运行 · 支持 ${fileManager} 与桌面`
                      : macos
                        ? !agent.accessibility
                          ? '请授权辅助功能，才能接收 Finder 的预览快捷键'
                          : !agent.automation
                            ? '请允许瞬览读取 Finder 中选中的文件'
                            : '键盘监听未就绪，请检查权限后重启瞬览'
                        : '原生监听未启动，请重新启动瞬览'}
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={settings.spaceEnabled}
                  aria-label={`${fileManager} 快捷键预览`}
                  className={`switch ${settings.spaceEnabled ? 'on' : ''}`}
                  onClick={() => setSettings((s) => ({ ...s, spaceEnabled: !s.spaceEnabled }))}
                >
                  <span />
                </button>
              </div>
            )}
            {desktop && macos && agent?.supported && !agent.running && (
              <div className="mac-permissions">
                <p>
                  系统设置 → 隐私与安全性：在「辅助功能」中启用瞬览， 并在「自动化」中允许控制
                  Finder。 若键盘监听仍未就绪，检查「输入监控」或重启应用。
                  未授权时仍可选择文件或拖入预览，Finder 原有空格预览保持可用。
                </p>
                <button
                  onClick={() => {
                    void invoke('request_agent_permissions')
                      .then(() => setToast('请在 macOS 系统权限提示中完成授权，状态会自动更新。'))
                      .catch((error) => setToast(`权限请求失败：${String(error)}`));
                  }}
                >
                  授权 Finder 预览
                </button>
              </div>
            )}
            <h3>预览快捷键</h3>
            <div className="shortcut-editors">
              {(['windowsShortcut', 'macosShortcut'] as const).map((platform) => (
                <div className="shortcut-editor" key={platform}>
                  <span>{platform === 'windowsShortcut' ? 'Windows' : 'macOS'}</span>
                  <button
                    className={`shortcut-record ${recording === platform ? 'recording' : ''}`}
                    aria-label={`修改 ${platform === 'windowsShortcut' ? 'Windows' : 'macOS'} 预览快捷键`}
                    onClick={() => {
                      spaceAction.current = null;
                      setRecording(platform);
                      setShortcutError('');
                    }}
                    onBlur={() =>
                      setRecording((current) => (current === platform ? null : current))
                    }
                  >
                    <Keyboard size={15} />
                    {recording === platform
                      ? '请按快捷键…'
                      : shortcutLabel(settings[platform], platform === 'macosShortcut')}
                  </button>
                  <button
                    className="shortcut-reset"
                    aria-label={`恢复 ${platform === 'windowsShortcut' ? 'Windows' : 'macOS'} 默认快捷键`}
                    onClick={() => {
                      setRecording(null);
                      setShortcutError('');
                      setSettings((s) => ({ ...s, [platform]: defaultShortcut }));
                    }}
                  >
                    重置
                  </button>
                </div>
              ))}
            </div>
            <p
              className={`shortcut-help ${shortcutError ? 'shortcut-error' : ''}`}
              role={shortcutError ? 'alert' : undefined}
            >
              {shortcutError ||
                '点击按键后录入，自动保存；Esc 取消。Shift + 预览快捷键用于纯文本模式。请避开系统已占用的组合。'}
            </p>
            <h3>常用操作</h3>
            <div className="shortcuts">
              {[
                ['选择文件', 'Ctrl / ⌘ + O'],
                ['关闭预览', `${previewKey} / Esc`],
                ['切换文件', '←  →'],
                ['纯文本预览', `Shift + ${previewKey}`],
                ['复制路径', 'Ctrl / ⌘ + Shift + C'],
                ['默认应用打开', 'Enter'],
              ].map(([label, key]) => (
                <div key={label}>
                  <span>{label}</span>
                  <kbd>{key}</kbd>
                </div>
              ))}
            </div>
            <div className="settings-note">
              <Info size={16} />
              <p>
                {desktop
                  ? agent?.supported
                    ? `瞬览运行时，在 ${fileManager} 或桌面选中文件，按 ${previewKey} 即可预览。${macos ? '首次使用需要系统授权。关闭窗口后仍在菜单栏运行。' : '关闭窗口后仍在托盘运行。'}`
                    : '当前系统支持文件选择与拖入，暂未接入文件管理器空格预览。'
                  : '这里可以预览真实文件。资源管理器唤起、默认应用打开和同目录导航，需要桌面版。'}
              </p>
            </div>
          </section>
        </div>
      )}
      {dragging && (
        <div className="drop-overlay">
          <Upload size={42} />
          <h2>松开，即刻预览</h2>
          <p>支持一次拖入多个文件</p>
        </div>
      )}
      {opening && <div className="opening-indicator">正在读取文件…</div>}
      {toast && (
        <div className="toast" role="status">
          <Info size={16} />
          <span>{toast}</span>
          <button title="关闭提示" onClick={() => setToast('')}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
