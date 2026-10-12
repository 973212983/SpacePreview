import PreviewToolbar from './PreviewToolbar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  LockKeyhole,
  Search,
  Eye,
  FolderOpen,
} from 'lucide-react';
import { extension, formatSize, previewMime, type PreviewFile } from '../lib/files';
import { readRange } from '../lib/bridge';
import { readZipDirectory, readZipEntry, ZIP_ENTRY_LIMIT } from '../lib/zip-range';
import { parseInWorker } from '../lib/worker-client';
import type { ArchiveEntry } from '../lib/worker-types';
import FileIcon, { fileTypeLabel } from './FileIcon';
import { openArchive } from '../lib/archive-session';
const fileNames = new Intl.Collator('zh-CN', { numeric: true });

function entryReason(entry: ArchiveEntry) {
  return entry.directory
    ? ''
    : entry.encrypted
      ? '已加密'
      : entry.sourcePath !== undefined
        ? entry.size > 256 * 1024 * 1024
          ? '超过 256 MB'
          : ''
        : ![0, 8].includes(entry.method ?? -1)
          ? '算法不支持'
          : entry.size > ZIP_ENTRY_LIMIT || entry.compressed > ZIP_ENTRY_LIMIT
            ? '超过 32 MB'
            : '';
}

export default function ArchivePreview({
  file,
  onOpen,
}: {
  file: PreviewFile;
  onOpen: (file: PreviewFile) => void;
}) {
  const [entries, setEntries] = useState<ArchiveEntry[] | null>(null);
  const [error, setError] = useState('');
  const [entryError, setEntryError] = useState('');
  const [folder, setFolder] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [selected, setSelected] = useState('');
  const [reload, setReload] = useState(0);
  const [password, setPassword] = useState('');
  const session = useRef<Awaited<ReturnType<typeof openArchive>> | null>(null);
  const zip = [
    'zip',
    'jar',
    'apk',
    'ipa',
    'cbz',
    'whl',
    'nupkg',
    'snupkg',
    'vsix',
    'xpi',
    'egg',
    'pyz',
    'appx',
    'appxbundle',
    'msix',
    'msixbundle',
    'aab',
    'hap',
    'wgt',
    'wgtu',
    'qlplugin',
  ].includes(extension(file.name));
  const [sort, setSort] = useState<{
    key: 'name' | 'type' | 'size' | 'compressed';
    descending: boolean;
  }>({ key: 'name', descending: false });
  const extraction = useRef<AbortController | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const read = (offset: number, length: number) => readRange(file, offset, length);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setError('');
      setEntries(null);
      if (!zip) {
        const archive = await openArchive(file, controller.signal, password);
        if (controller.signal.aborted) {
          archive.close();
          return;
        }
        session.current = archive;
        setEntries(archive.entries);
        return;
      }
      const directory = await readZipDirectory(file.size, (offset, length) =>
        readRange(file, offset, length),
      );
      if (controller.signal.aborted) return;
      const parsed = await parseInWorker(
        { kind: 'archive-directory', name: file.name, ...directory },
        controller.signal,
      );
      if (!controller.signal.aborted) setEntries(parsed.entries!);
    };
    void load().catch((e) => {
      if (!controller.signal.aborted) setError(e.message);
    });
    return () => {
      controller.abort();
      session.current?.close();
      session.current = null;
      extraction.current?.abort();
    };
  }, [file, reload, zip]);
  const rows = useMemo(() => {
    if (!entries) return [];
    const folders = new Map<string, ArchiveEntry>();
    const files: ArchiveEntry[] = [];
    for (const entry of entries) {
      if (!entry.name.startsWith(folder)) continue;
      const relative = entry.name.slice(folder.length);
      if (!relative) continue;
      const slash = relative.indexOf('/');
      if (slash >= 0) {
        const path = folder + relative.slice(0, slash + 1);
        if (!folders.has(path))
          folders.set(path, {
            name: path,
            directory: true,
            index: entry.index,
            size: 0,
            compressed: 0,
          });
      } else files.push(entry);
    }
    const result = query
      ? entries.filter((entry) => entry.name.toLowerCase().includes(query.toLowerCase()))
      : [...folders.values(), ...files];
    const types =
      sort.key === 'type'
        ? new Map(result.map((entry) => [entry, fileTypeLabel(entry.name)]))
        : undefined;
    return result.sort((a, b) => {
      if (a.directory !== b.directory) return a.directory ? -1 : 1;
      const compared =
        sort.key === 'name'
          ? fileNames.compare(a.name, b.name)
          : sort.key === 'type'
            ? fileNames.compare(types!.get(a)!, types!.get(b)!)
            : a[sort.key] - b[sort.key];
      return (sort.descending ? -compared : compared) || fileNames.compare(a.name, b.name);
    });
  }, [entries, folder, query, sort]);
  useEffect(() => {
    setSelected('');
    if (list.current) list.current.scrollTop = 0;
  }, [folder, query, page, sort]);
  const current = rows.find((entry) => entry.name === selected);
  const sortBy = (key: typeof sort.key) => {
    setSelected('');
    setSort((old) => ({ key, descending: old.key === key && !old.descending }));
    setPage(0);
  };
  const openEntry = async (entry: ArchiveEntry) => {
    if (entry.directory) {
      setFolder(entry.name);
      setQuery('');
      setPage(0);
      return;
    }
    extraction.current?.abort();
    const controller = new AbortController();
    extraction.current = controller;
    setExtracting(true);
    setEntryError('');
    try {
      let blob: Blob;
      if (session.current) {
        blob = await session.current.extract(entry);
      } else {
        const bytes = await readZipEntry(entry, file.size, read);
        if (controller.signal.aborted) return;
        const result = await parseInWorker(
          { kind: 'archive-data', name: file.name, bytes, entry },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        blob = new Blob([result.data as Uint8Array<ArrayBuffer>]);
      }
      if (controller.signal.aborted) return;
      const name = entry.name.split('/').pop() || entry.name;
      const mime = previewMime(name);
      blob = blob.slice(0, blob.size, mime);
      onOpen({
        id: crypto.randomUUID(),
        name,
        size: blob.size,
        modified: file.modified,
        mime,
        blob,
      });
    } catch (e) {
      if (!controller.signal.aborted) setEntryError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!controller.signal.aborted) setExtracting(false);
    }
  };
  const passwordControls = !zip && (
    <PreviewToolbar className="content-toolbar">
      <label className="preview-menu-option">
        <span>压缩包密码</span>
        <input
          type="password"
          aria-label="压缩包密码"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <button onClick={() => setReload((value) => value + 1)}>使用密码重新读取</button>
    </PreviewToolbar>
  );
  if (error)
    return (
      <>
        {passwordControls}
        <div className="preview-message" role="alert">
          {error}
          <p>可在底部使用默认应用打开。</p>
        </div>
      </>
    );
  if (!entries)
    return (
      <div className="preview-message" role="status">
        <span className="spinner" />
        正在读取压缩包目录…
      </div>
    );
  const pageCount = Math.max(1, Math.ceil(rows.length / 100));
  return (
    <div className="archive-preview">
      {passwordControls}
      <PreviewToolbar className="content-toolbar archive-toolbar">
        <span title={`${formatSize(file.size)} · ${zip ? '按需读取' : '后台解码'}`}>
          {entries.length.toLocaleString()} 项
        </span>
        <button
          className="archive-open"
          disabled={!current || extracting || Boolean(entryReason(current))}
          onClick={() => current && void openEntry(current)}
        >
          {current?.directory ? <FolderOpen size={15} /> : <Eye size={15} />}{' '}
          {current?.directory ? '打开文件夹' : '预览'}
        </button>
        <label className="search">
          <Search size={14} />
          <input
            aria-label="筛选压缩包内容"
            placeholder="搜索整个压缩包"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
      </PreviewToolbar>
      <div className="archive-breadcrumb">
        <button
          disabled={!folder || Boolean(query)}
          title="上一级目录"
          onClick={() => {
            setFolder(folder.replace(/[^/]+\/$/, ''));
            setPage(0);
          }}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => {
            setFolder('');
            setQuery('');
            setPage(0);
          }}
        >
          压缩包根目录
        </button>
        {query ? (
          <span>搜索结果</span>
        ) : (
          folder
            .split('/')
            .filter(Boolean)
            .map((part, i, parts) => (
              <button
                key={i}
                onClick={() => {
                  setFolder(parts.slice(0, i + 1).join('/') + '/');
                  setPage(0);
                }}
              >
                <ChevronRight size={13} />
                {part}
              </button>
            ))
        )}
      </div>
      <div ref={list} className="archive-list" role="grid" aria-label="压缩包文件列表">
        <div className="archive-heading" role="row">
          {(
            [
              ['name', '名称'],
              ['type', '类型'],
              ['size', '大小'],
              ['compressed', '压缩后'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="columnheader"
              aria-sort={sort.key === key ? (sort.descending ? 'descending' : 'ascending') : 'none'}
              onClick={() => sortBy(key)}
            >
              {label}
              <ArrowUpDown size={12} />
            </button>
          ))}
        </div>
        {rows.slice(page * 100, (page + 1) * 100).map((entry, rowIndex) => {
          const reason = entryReason(entry);
          return (
            <button
              className={`archive-row ${selected === entry.name ? 'selected' : ''}`}
              role="row"
              aria-selected={selected === entry.name}
              tabIndex={selected === entry.name || (!selected && rowIndex === 0) ? 0 : -1}
              key={`${entry.index}:${entry.name}`}
              title={reason ? `${entry.name} · ${reason}` : entry.name}
              disabled={extracting || Boolean(reason)}
              onClick={() => setSelected(entry.name)}
              onDoubleClick={() => void openEntry(entry)}
              onKeyDown={(event) => {
                if (
                  ![
                    'Enter',
                    'ArrowUp',
                    'ArrowDown',
                    'ArrowLeft',
                    'ArrowRight',
                    'Home',
                    'End',
                  ].includes(event.key)
                )
                  return;
                event.preventDefault();
                event.stopPropagation();
                if (event.key === 'Enter' || (event.key === 'ArrowRight' && entry.directory)) {
                  void openEntry(entry);
                  return;
                }
                if (event.key === 'ArrowLeft') {
                  if (folder) {
                    setFolder(folder.replace(/[^/]+\/$/, ''));
                    setPage(0);
                  }
                  return;
                }
                const buttons = [
                  ...event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>(
                    '.archive-row:not(:disabled)',
                  ),
                ];
                const position = buttons.indexOf(event.currentTarget);
                const next =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? buttons.length - 1
                      : position +
                        (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0);
                buttons[Math.max(0, Math.min(buttons.length - 1, next))]?.focus();
              }}
              onFocus={() => setSelected(entry.name)}
            >
              <span role="gridcell" className="archive-name">
                <FileIcon name={entry.name} folder={entry.directory} size={27} />
                <span className="archive-filename">
                  {query ? entry.name : entry.name.slice(folder.length).replace(/\/$/, '')}
                  {reason && (
                    <small>
                      {entry.encrypted && <LockKeyhole size={11} />} {reason}
                    </small>
                  )}
                </span>
              </span>
              <span role="gridcell" className="archive-type">
                {fileTypeLabel(entry.name, entry.directory)}
              </span>
              <span role="gridcell" className="archive-size">
                {entry.directory ? '—' : formatSize(entry.size)}
              </span>
              <span role="gridcell" className="archive-compressed">
                {entry.directory || entry.compressed < 0 ? '—' : formatSize(entry.compressed)}
              </span>
            </button>
          );
        })}
        {!rows.length && <p className="empty-filter">没有匹配的条目。</p>}
      </div>
      <div className="archive-paging">
        <span>
          {rows.length.toLocaleString()} 项 · {selected ? '已选中 1 项' : '双击或 Enter 打开'}
        </span>
        <button
          aria-label="压缩包上一页"
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          <ChevronLeft size={15} />
        </button>
        <span>
          {page + 1} / {pageCount}
        </span>
        <button
          aria-label="压缩包下一页"
          disabled={page + 1 >= pageCount}
          onClick={() => setPage((p) => p + 1)}
        >
          <ChevronRight size={15} />
        </button>
      </div>
      {(entryError || extracting) && (
        <div className="archive-feedback" role={entryError ? 'alert' : 'status'}>
          {entryError || '正在读取并校验所选条目…'}
          {extracting && (
            <button
              onClick={() => {
                extraction.current?.abort();
                if (!zip) {
                  session.current?.close();
                  setReload((value) => value + 1);
                }
                setExtracting(false);
              }}
            >
              取消
            </button>
          )}
        </div>
      )}
    </div>
  );
}
