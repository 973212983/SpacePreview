import { useCallback, useEffect, useRef, useState } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { desktop } from './bridge';

type Phase =
  | 'idle'
  | 'checking'
  | 'current'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'installed'
  | 'error';
type UpdateState = {
  phase: Phase;
  version?: string;
  notes?: string;
  downloaded: number;
  total?: number;
  error?: string;
};

/** Keep the update resource alive when settings close or the previewed file changes. */
export function useAppUpdate() {
  const [state, setState] = useState<UpdateState>({ phase: 'idle', downloaded: 0 });
  const [notice, setNotice] = useState(false);
  const update = useRef<Update | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const checked = useRef(false);

  const release = useCallback(() => {
    const previous = update.current;
    update.current = null;
    void previous?.close().catch(() => {});
  }, []);

  const checkUpdate = useCallback(async () => {
    if (!desktop || busy.current) return;
    busy.current = true;
    checked.current = true;
    release();
    setNotice(false);
    setState({ phase: 'checking', downloaded: 0 });
    try {
      const found = await check({ timeout: 15_000 });
      if (!mounted.current) {
        await found?.close();
        return;
      }
      update.current = found;
      setState(
        found
          ? { phase: 'available', version: found.version, notes: found.body, downloaded: 0 }
          : { phase: 'current', downloaded: 0 },
      );
      setNotice(!!found);
    } catch {
      if (mounted.current)
        setState({
          phase: 'error',
          downloaded: 0,
          error: '暂时无法检查更新，请检查网络连接后重试。',
        });
    } finally {
      busy.current = false;
    }
  }, [release]);

  const restart = useCallback(async () => {
    try {
      await relaunch();
    } catch {
      if (mounted.current)
        setState((current) => ({
          ...current,
          phase: 'installed',
          error: '更新已安装，但自动重启失败。请点击重启，或退出瞬览后重新打开。',
        }));
    }
  }, []);

  const installUpdate = useCallback(async () => {
    const found = update.current;
    if (!found || busy.current) return;
    busy.current = true;
    setNotice(false);
    setState((current) => ({
      ...current,
      phase: 'downloading',
      downloaded: 0,
      total: undefined,
      error: undefined,
    }));
    try {
      // The native updater verifies the signature before running the installer.
      await found.downloadAndInstall(
        (event) => {
          if (!mounted.current) return;
          if (event.event === 'Started')
            setState((current) => ({
              ...current,
              downloaded: 0,
              total: event.data.contentLength,
            }));
          else if (event.event === 'Progress')
            setState((current) => ({
              ...current,
              downloaded: current.downloaded + event.data.chunkLength,
            }));
          else setState((current) => ({ ...current, phase: 'installing' }));
        },
        { timeout: 30 * 60_000 },
      );
      if (mounted.current) setState((current) => ({ ...current, phase: 'installed' }));
      release();
      // Windows exits when its installer starts; macOS needs an explicit relaunch.
      await restart();
    } catch {
      if (mounted.current)
        setState((current) => ({
          ...current,
          phase: 'error',
          error:
            '更新未能完成，可能是网络、签名校验或安装权限问题。请检查网络连接和安装权限后重试。',
        }));
    } finally {
      busy.current = false;
      if (!mounted.current) release();
    }
  }, [release, restart]);

  useEffect(() => {
    mounted.current = true;
    // Delay the first network request so file preview startup stays responsive.
    const timer = desktop
      ? setTimeout(() => {
          if (!checked.current) void checkUpdate();
        }, 10_000)
      : undefined;
    return () => {
      mounted.current = false;
      clearTimeout(timer);
      if (!busy.current) release();
    };
  }, [checkUpdate, release]);

  return { state, notice, dismiss: () => setNotice(false), checkUpdate, installUpdate, restart };
}

export type AppUpdate = ReturnType<typeof useAppUpdate>;
