import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ChevronUp, ChevronDown, Search, X } from 'lucide-react';
import { findRanges, scrollToRange } from '../lib/find';

export interface SearchHit {
  label?: string;
  goTo: (signal: AbortSignal) => void | Promise<void>;
}
export interface SearchSource {
  scope: string;
  search: (query: string, signal: AbortSignal) => SearchHit[] | Promise<SearchHit[]>;
}
const Source = createContext<((source: SearchSource) => () => void) | null>(null);
export function useFileSearch(source: SearchSource | null) {
  const register = useContext(Source);
  useEffect(() => (source && register ? register(source) : undefined), [source, register]);
}

export default function FileSearch({ active, children }: { active: boolean; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<SearchSource | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const register = useCallback((value: SearchSource) => {
    setSource(value);
    return () => setSource((current) => (current === value ? null : current));
  }, []);
  const documents = useCallback(() => {
    const roots: Element[] = root.current ? [root.current] : [];
    root.current?.querySelectorAll('iframe').forEach((frame) => {
      if (frame.contentDocument?.body) roots.push(frame.contentDocument.body);
    });
    return roots;
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    if (
      document.activeElement instanceof HTMLElement &&
      root.current?.contains(document.activeElement)
    )
      document.activeElement.blur();
  }, []);
  useEffect(() => {
    if (!active) {
      close();
      return;
    }
    const show = () => {
      setOpen(true);
      requestAnimationFrame(() => {
        input.current?.focus();
        input.current?.select();
      });
    };
    window.addEventListener('preview-find', show);
    window.addEventListener('preview-find-close', close);
    return () => {
      window.removeEventListener('preview-find', show);
      window.removeEventListener('preview-find-close', close);
    };
  }, [active, close]);
  useEffect(() => {
    if (open && active) {
      input.current?.focus();
      input.current?.select();
    }
  }, [open, active]);
  useEffect(() => {
    if (!open || !active || !root.current) return;
    let timer: ReturnType<typeof setTimeout>;
    const observer = new MutationObserver((records) => {
      if (
        records.every((record) =>
          (record.target instanceof Element ? record.target : record.target.parentElement)?.closest(
            '[data-file-search]',
          ),
        )
      )
        return;
      clearTimeout(timer);
      timer = setTimeout(() => setRevision((value) => value + 1), 150);
    });
    const refresh = () => setRevision((value) => value + 1);
    root.current.addEventListener('load', refresh, true);
    for (const element of documents())
      observer.observe(element, { childList: true, subtree: true, characterData: true });
    const host = root.current;
    return () => {
      observer.disconnect();
      clearTimeout(timer);
      host.removeEventListener('load', refresh, true);
    };
  }, [open, active, documents, revision]);
  useEffect(() => {
    setHits([]);
    setIndex(0);
    setError('');
    if (!open || !active || !query) {
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    setBusy(true);
    const timer = setTimeout(() => {
      void Promise.resolve()
        .then(() =>
          source
            ? source.search(query, controller.signal)
            : documents().flatMap((element) =>
                findRanges(element, query).map((range) => ({ goTo: () => scrollToRange(range) })),
              ),
        )
        .then((matches) => {
          if (!controller.signal.aborted) {
            setHits(matches);
            setBusy(false);
          }
        })
        .catch((reason) => {
          if (!controller.signal.aborted) {
            setError(String(reason));
            setBusy(false);
          }
        });
    }, 180);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, active, query, source, documents, source ? 0 : revision]);
  useEffect(() => {
    if (!open || !active || !query) return;
    const cleanups: (() => void)[] = [];
    for (const element of documents()) {
      const doc = element.ownerDocument;
      const win = doc.defaultView as (Window & typeof globalThis) | null;
      if (!win?.CSS?.highlights || !win.Highlight) continue;
      const highlight = new win.Highlight();
      for (const range of findRanges(element, query)) highlight.add(range);
      win.CSS.highlights.set('preview-find', highlight);
      const style = doc.createElement('style');
      style.textContent = '::highlight(preview-find){background:#ffe078;color:#17202b}';
      doc.head.append(style);
      cleanups.push(() => {
        if (win.CSS.highlights.get('preview-find') === highlight)
          win.CSS.highlights.delete('preview-find');
        style.remove();
      });
    }
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [open, active, query, revision, documents]);
  useEffect(() => {
    if (!open || !active || !hits[index]) return;
    const controller = new AbortController();
    void Promise.resolve(hits[index].goTo(controller.signal)).catch((reason) => {
      if (!controller.signal.aborted) setError(String(reason));
    });
    return () => controller.abort();
  }, [open, active, hits, index]);
  const move = (direction: number) => {
    if (hits.length) setIndex((current) => (current + direction + hits.length) % hits.length);
  };
  return (
    <Source.Provider value={register}>
      <div className="file-search-host" ref={root}>
        {open && active && (
          <div
            className="file-search"
            data-file-search
            role="search"
            aria-label="文件内检索"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && event.target === input.current) {
                event.preventDefault();
                move(event.shiftKey ? -1 : 1);
              }
            }}
          >
            <Search size={15} />
            <input
              ref={input}
              aria-label="查找当前文件"
              placeholder={source?.scope ? `搜索${source.scope}` : '搜索当前预览'}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <span role="status">
              {error ||
                (busy
                  ? '检索中…'
                  : query
                    ? hits.length
                      ? `${index + 1} / ${hits.length}`
                      : '无匹配'
                    : '')}
            </span>
            {hits[index]?.label && (
              <span className="file-search-location" title={hits[index].label}>
                {hits[index].label}
              </span>
            )}
            <button
              aria-label="上一个匹配"
              title="上一个 · Shift+Enter"
              disabled={!hits.length}
              onClick={() => move(-1)}
            >
              <ChevronUp size={15} />
            </button>
            <button
              aria-label="下一个匹配"
              title="下一个 · Enter"
              disabled={!hits.length}
              onClick={() => move(1)}
            >
              <ChevronDown size={15} />
            </button>
            <button aria-label="关闭文件检索" title="关闭 · Esc" onClick={close}>
              <X size={15} />
            </button>
          </div>
        )}
        {children}
      </div>
    </Source.Provider>
  );
}
