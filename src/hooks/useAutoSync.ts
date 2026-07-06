import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch } from "react";
import type { AppAction } from "../state/appState";
import type { AppState } from "../types";
import { nowIso } from "../services/id";
import {
  createStateFingerprint,
  loadSyncConfig,
  markSyncConflict,
  markSyncError,
  markSynced,
  normalizeSyncConfig,
  readRemoteSyncSnapshot,
  saveSyncConfig,
  SYNC_CONFIG_CHANGED_EVENT,
  uploadStateToSyncTarget
} from "../services/sync";
import type { SyncConfig } from "../services/sync";
import type { StorageStatus } from "./usePersistentAppState";

const LOCAL_UPLOAD_DEBOUNCE_MS = 5000;
const STARTUP_REMOTE_CHECK_DELAY_MS = 3000;

export interface AutoSyncControls {
  uploadNow: () => Promise<void>;
}

export function useAutoSync(state: AppState, dispatch: Dispatch<AppAction>, storageStatus: StorageStatus): AutoSyncControls {
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const stateRef = useRef(state);
  const configRef = useRef<SyncConfig | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    let cancelled = false;

    loadSyncConfig().then((loadedConfig) => {
      if (cancelled) return;
      setConfig(loadedConfig);
    });

    const handleConfigChange = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      setConfig(normalizeSyncConfig(detail));
    };

    window.addEventListener(SYNC_CONFIG_CHANGED_EVENT, handleConfigChange);
    return () => {
      cancelled = true;
      window.removeEventListener(SYNC_CONFIG_CHANGED_EVENT, handleConfigChange);
    };
  }, []);

  const persistConfig = useCallback(async (nextConfig: SyncConfig) => {
    setConfig(nextConfig);
    await saveSyncConfig(nextConfig);
  }, []);

  const runWithLock = useCallback(async (task: () => Promise<void>) => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      await task();
    } finally {
      runningRef.current = false;
    }
  }, []);

  const runAutoUpload = useCallback(async () => {
    await runWithLock(async () => {
      const currentConfig = configRef.current;
      if (!currentConfig?.autoSyncEnabled) return;

      const localState = stateRef.current;
      const localFingerprint = createStateFingerprint(localState);
      if (localFingerprint === currentConfig.lastSyncedStateFingerprint) return;

      if (currentConfig.lastRemoteStateFingerprint) {
        try {
          const remote = await readRemoteSyncSnapshot(currentConfig);
          const remoteChanged = remote.fingerprint !== currentConfig.lastRemoteStateFingerprint;
          const localChanged = localFingerprint !== currentConfig.lastSyncedStateFingerprint;
          if (remoteChanged && localChanged) {
            await persistConfig(markSyncConflict(currentConfig, "自动上传前检测到远端也有新变化。"));
            return;
          }
        } catch (error) {
          await persistConfig(markSyncError(currentConfig, error instanceof Error ? error.message : "自动上传前检查远端失败。"));
          return;
        }
      }

      try {
        const result = await uploadStateToSyncTarget(currentConfig, localState);
        await persistConfig({
          ...result.config,
          lastSyncMessage: `自动上传完成：${result.remoteLabel}。`
        });
      } catch (error) {
        await persistConfig(markSyncError(currentConfig, error instanceof Error ? error.message : "自动上传失败。"));
      }
    });
  }, [persistConfig, runWithLock]);

  const runRemoteCheck = useCallback(async () => {
    await runWithLock(async () => {
      const currentConfig = configRef.current;
      if (!currentConfig?.autoSyncEnabled || !currentConfig.lastSyncedStateFingerprint) return;

      const localState = stateRef.current;
      const localFingerprint = createStateFingerprint(localState);

      try {
        const remote = await readRemoteSyncSnapshot(currentConfig);
        if (remote.fingerprint === localFingerprint) {
          await persistConfig(
            markSynced(currentConfig, currentConfig.provider, nowIso(), localFingerprint, `自动检查完成：${remote.remoteLabel} 已是最新。`)
          );
          return;
        }

        if (localFingerprint === currentConfig.lastSyncedStateFingerprint) {
          await persistConfig(
            markSynced(currentConfig, currentConfig.provider, nowIso(), remote.fingerprint, `自动拉取完成：${remote.remoteLabel}。`)
          );
          dispatch({ type: "replaceState", state: remote.state });
          return;
        }

        await persistConfig(markSyncConflict(currentConfig, "自动拉取前检测到本地和远端都有新变化。"));
      } catch (error) {
        await persistConfig(markSyncError(currentConfig, error instanceof Error ? error.message : "自动检查远端失败。"));
      }
    });
  }, [dispatch, persistConfig, runWithLock]);

  useEffect(() => {
    if (storageStatus !== "ready" || !config?.autoSyncEnabled) return undefined;

    const timer = window.setTimeout(() => {
      void runAutoUpload();
    }, LOCAL_UPLOAD_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [config?.autoSyncEnabled, runAutoUpload, state, storageStatus]);

  useEffect(() => {
    if (storageStatus !== "ready" || !config?.autoSyncEnabled) return undefined;

    const startupTimer = window.setTimeout(() => {
      void runRemoteCheck();
    }, STARTUP_REMOTE_CHECK_DELAY_MS);
    const interval = window.setInterval(() => {
      void runRemoteCheck();
    }, config.autoSyncIntervalMinutes * 60 * 1000);

    return () => {
      window.clearTimeout(startupTimer);
      window.clearInterval(interval);
    };
  }, [config, runRemoteCheck, storageStatus]);

  const uploadNow = useCallback(async () => {
    if (storageStatus !== "ready") return;
    await runAutoUpload();
  }, [runAutoUpload, storageStatus]);

  return { uploadNow };
}
