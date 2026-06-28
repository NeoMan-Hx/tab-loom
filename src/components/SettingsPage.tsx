import { ArrowLeft, Cloud, Download, DownloadCloud, GitBranch, Moon, Monitor, Save, Sun, Upload, UploadCloud } from "lucide-react";
import type { ChangeEvent, Dispatch } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AppAction } from "../state/appState";
import { appendImportedText, createExportText } from "../services/importExport";
import {
  DEFAULT_SYNC_CONFIG,
  downloadStateFromSyncTarget,
  loadSyncConfig,
  saveSyncConfig,
  uploadStateToSyncTarget
} from "../services/sync";
import type { SyncConfig, SyncProvider } from "../services/sync";
import type { AppState, OpenFolderMode, OpenSavedTabMode, ThemeMode } from "../types";

interface SettingsPageProps {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  onBack: () => void;
}

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; description: string; icon: typeof Sun }> = [
  { value: "light", label: "白天", description: "始终使用明亮界面", icon: Sun },
  { value: "dark", label: "夜间", description: "使用 Codex 风格深灰界面", icon: Moon },
  { value: "black", label: "纯黑", description: "OLED 友好的纯黑背景", icon: Moon },
  { value: "system", label: "跟随系统", description: "跟随系统外观偏好", icon: Monitor }
];

const OPEN_TAB_OPTIONS: Array<{ value: OpenSavedTabMode; label: string; description: string }> = [
  { value: "new-tab", label: "新标签页打开", description: "点击保存卡片时创建新的 Chrome 标签页。" },
  { value: "current-tab", label: "当前页跳转", description: "点击保存卡片时复用当前新标签页。" }
];

const OPEN_FOLDER_OPTIONS: Array<{ value: OpenFolderMode; label: string; description: string }> = [
  { value: "direct", label: "直接打开", description: "打开全部时只创建普通标签页。" },
  { value: "chrome-group", label: "Chrome 分组", description: "打开全部后尽量放进同一个 Chrome 标签组。" }
];

export function SettingsPage({ state, dispatch, onBack }: SettingsPageProps) {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [lastImportMessage, setLastImportMessage] = useState("");
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(DEFAULT_SYNC_CONFIG);
  const [syncLoading, setSyncLoading] = useState(true);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    loadSyncConfig()
      .then((config) => {
        if (cancelled) return;
        setSyncConfig(config);
      })
      .catch((error) => {
        if (cancelled) return;
        setSyncMessage(error instanceof Error ? error.message : "同步设置读取失败。");
      })
      .finally(() => {
        if (!cancelled) setSyncLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const workspaces = Object.keys(state.workspaces).length;
    const folders = Object.keys(state.folders).length;
    const tabs = Object.keys(state.savedTabs).length;
    return { workspaces, folders, tabs };
  }, [state.folders, state.savedTabs, state.workspaces]);

  const handleExport = () => {
    const blob = new Blob([createExportText(state)], { type: "application/json;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `tab-loom-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(href);
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const result = appendImportedText(state, text);
      dispatch({ type: "replaceState", state: result.state });
      const message = `已追加导入 ${result.summary.workspaces} 个工作区、${result.summary.folders} 个文件夹、${result.summary.tabs} 个标签页。`;
      setLastImportMessage(result.summary.skippedTabs > 0 ? `${message} 已跳过 ${result.summary.skippedTabs} 个无效标签页。` : message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "导入失败。";
      setLastImportMessage(message);
      alert(message);
    }
  };

  const updateSyncProvider = (provider: SyncProvider) => {
    setSyncConfig((current) => ({ ...current, provider }));
  };

  const updateWebDavConfig = (patch: Partial<SyncConfig["webdav"]>) => {
    setSyncConfig((current) => ({ ...current, webdav: { ...current.webdav, ...patch } }));
  };

  const updateGistConfig = (patch: Partial<SyncConfig["gist"]>) => {
    setSyncConfig((current) => ({ ...current, gist: { ...current.gist, ...patch } }));
  };

  const updateAutoSyncConfig = (patch: Pick<Partial<SyncConfig>, "autoSyncEnabled" | "autoSyncIntervalMinutes">) => {
    setSyncConfig((current) => ({ ...current, ...patch }));
  };

  const handleSaveSyncConfig = async () => {
    setSyncBusy(true);
    setSyncMessage("");
    try {
      await saveSyncConfig(syncConfig);
      setSyncMessage("同步设置已保存。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步设置保存失败。";
      setSyncMessage(message);
      alert(message);
    } finally {
      setSyncBusy(false);
    }
  };

  const handleUploadSync = async () => {
    setSyncBusy(true);
    setSyncMessage("");
    try {
      await saveSyncConfig(syncConfig);
      const result = await uploadStateToSyncTarget(syncConfig, state);
      setSyncConfig(result.config);
      await saveSyncConfig(result.config);
      setSyncMessage(`已上传到 ${result.remoteLabel}。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "上传同步失败。";
      setSyncMessage(message);
      alert(message);
    } finally {
      setSyncBusy(false);
    }
  };

  const handleDownloadSync = async () => {
    if (!confirm("从远端拉取会用远端配置覆盖当前本地工作区。继续？")) return;

    setSyncBusy(true);
    setSyncMessage("");
    try {
      await saveSyncConfig(syncConfig);
      const result = await downloadStateFromSyncTarget(syncConfig);
      dispatch({ type: "replaceState", state: result.state });
      setSyncConfig(result.config);
      await saveSyncConfig(result.config);
      setSyncMessage(`已从 ${result.remoteLabel} 拉取并替换本地数据。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "拉取同步失败。";
      setSyncMessage(message);
      alert(message);
    } finally {
      setSyncBusy(false);
    }
  };

  return (
    <section className="settings-page" aria-label="设置">
      <div className="settings-heading">
        <button className="secondary-button" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          返回工作台
        </button>
        <div>
          <p className="eyebrow">Settings</p>
          <h2>设置</h2>
        </div>
      </div>

      <div className="settings-grid">
        <section className="settings-panel">
          <div className="settings-panel-heading">
            <h3>主题</h3>
            <p>选择新标签页的外观。</p>
          </div>
          <div className="theme-options">
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = state.settings.themeMode === option.value;
              return (
                <button
                  key={option.value}
                  className={selected ? "theme-option selected" : "theme-option"}
                  type="button"
                  onClick={() => dispatch({ type: "setThemeMode", themeMode: option.value })}
                >
                  <Icon size={18} />
                  <span>{option.label}</span>
                  <small>{option.description}</small>
                </button>
              );
            })}
          </div>
        </section>

        <section className="settings-panel">
          <div className="settings-panel-heading">
            <h3>打开方式</h3>
            <p>控制保存卡片和文件夹批量打开的行为。</p>
          </div>
          <div className="settings-option-list">
            {OPEN_TAB_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={state.settings.openSavedTabMode === option.value ? "settings-option selected" : "settings-option"}
                type="button"
                onClick={() => dispatch({ type: "setOpenSavedTabMode", mode: option.value })}
              >
                <span>{option.label}</span>
                <small>{option.description}</small>
              </button>
            ))}
          </div>
          <div className="settings-option-list">
            {OPEN_FOLDER_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={state.settings.openFolderMode === option.value ? "settings-option selected" : "settings-option"}
                type="button"
                onClick={() => dispatch({ type: "setOpenFolderMode", mode: option.value })}
              >
                <span>{option.label}</span>
                <small>{option.description}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="settings-panel">
          <div className="settings-panel-heading">
            <h3>右侧边栏</h3>
            <p>控制当前已打开标签页列表。</p>
          </div>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={state.settings.showPinnedOpenTabs}
              onChange={(event) => dispatch({ type: "setShowPinnedOpenTabs", showPinned: event.target.checked })}
            />
            <span>
              显示固定标签页
              <small>关闭后，右侧列表和保存全部都会忽略固定标签页。</small>
            </span>
          </label>
        </section>

        <section className="settings-panel">
          <div className="settings-panel-heading">
            <h3>数据</h3>
            <p>导入会追加到当前数据，不会覆盖已有工作区。</p>
          </div>
          <div className="settings-stats">
            <span>{stats.workspaces} 工作区</span>
            <span>{stats.folders} 文件夹</span>
            <span>{stats.tabs} 标签页</span>
          </div>
          <div className="settings-actions">
            <button className="primary-button" type="button" onClick={() => importInputRef.current?.click()}>
              <Upload size={17} />
              导入 JSON
            </button>
            <button className="secondary-button" type="button" onClick={handleExport}>
              <Download size={17} />
              导出 JSON
            </button>
            <input ref={importInputRef} className="visually-hidden" type="file" accept="application/json" onChange={handleImport} />
          </div>
          {lastImportMessage && <p className="settings-message">{lastImportMessage}</p>}
        </section>

        <section className="settings-panel settings-panel-wide">
          <div className="settings-panel-heading">
            <h3>配置同步</h3>
            <p>手动上传会覆盖远端，手动拉取会覆盖本地。同步凭据只保存在本机，不会进入导出 JSON 或远端文件。</p>
          </div>

          <div className="sync-provider-options" role="tablist" aria-label="同步方式">
            <button
              className={syncConfig.provider === "webdav" ? "sync-provider selected" : "sync-provider"}
              type="button"
              onClick={() => updateSyncProvider("webdav")}
            >
              <Cloud size={18} />
              <span>WebDAV</span>
            </button>
            <button
              className={syncConfig.provider === "gist" ? "sync-provider selected" : "sync-provider"}
              type="button"
              onClick={() => updateSyncProvider("gist")}
            >
              <GitBranch size={18} />
              <span>GitHub Gist</span>
            </button>
          </div>

          {syncConfig.provider === "webdav" ? (
            <div className="settings-form" aria-label="WebDAV 同步设置">
              <label className="settings-field">
                <span>WebDAV 文件地址</span>
                <input
                  type="url"
                  placeholder="https://example.com/remote.php/dav/files/me/tab-loom.json"
                  value={syncConfig.webdav.url}
                  onChange={(event) => updateWebDavConfig({ url: event.target.value })}
                />
              </label>
              <div className="settings-field-row">
                <label className="settings-field">
                  <span>用户名</span>
                  <input
                    type="text"
                    autoComplete="username"
                    value={syncConfig.webdav.username}
                    onChange={(event) => updateWebDavConfig({ username: event.target.value })}
                  />
                </label>
                <label className="settings-field">
                  <span>密码或应用密码</span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={syncConfig.webdav.password}
                    onChange={(event) => updateWebDavConfig({ password: event.target.value })}
                  />
                </label>
              </div>
              <p className="settings-help">WebDAV 地址需要是最终 JSON 文件地址。首次上传会用 PUT 创建或覆盖这个文件。</p>
            </div>
          ) : (
            <div className="settings-form" aria-label="GitHub Gist 同步设置">
              <label className="settings-field">
                <span>GitHub token</span>
                <input
                  type="password"
                  placeholder="需要 gist 权限"
                  autoComplete="off"
                  value={syncConfig.gist.token}
                  onChange={(event) => updateGistConfig({ token: event.target.value })}
                />
              </label>
              <div className="settings-field-row">
                <label className="settings-field">
                  <span>Gist ID</span>
                  <input
                    type="text"
                    placeholder="留空上传时自动创建"
                    value={syncConfig.gist.gistId}
                    onChange={(event) => updateGistConfig({ gistId: event.target.value })}
                  />
                </label>
                <label className="settings-field">
                  <span>文件名</span>
                  <input
                    type="text"
                    value={syncConfig.gist.fileName}
                    onChange={(event) => updateGistConfig({ fileName: event.target.value })}
                  />
                </label>
              </div>
              <p className="settings-help">首次上传会创建 secret Gist 并自动回填 Gist ID。Token 建议只授予 gist 权限。</p>
            </div>
          )}

          <div className="settings-form sync-auto-form" aria-label="自动同步设置">
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={syncConfig.autoSyncEnabled}
                onChange={(event) => updateAutoSyncConfig({ autoSyncEnabled: event.target.checked })}
              />
              <span>
                启用自动同步
                <small>本地修改后会延迟上传，并按间隔检查远端。检测到冲突时会自动暂停。</small>
              </span>
            </label>
            <label className="settings-field sync-interval-field">
              <span>远端检查间隔（分钟）</span>
              <input
                type="number"
                min={5}
                max={1440}
                step={5}
                value={syncConfig.autoSyncIntervalMinutes}
                onChange={(event) => updateAutoSyncConfig({ autoSyncIntervalMinutes: Number(event.target.value) })}
              />
            </label>
            <p className="settings-help">建议先手动上传或拉取一次建立同步基线；之后自动同步会根据本地和远端指纹判断是否安全更新。</p>
          </div>

          <div className="settings-actions">
            <button className="secondary-button" type="button" disabled={syncBusy || syncLoading} onClick={handleSaveSyncConfig}>
              <Save size={17} />
              保存同步设置
            </button>
            <button className="primary-button" type="button" disabled={syncBusy || syncLoading} onClick={handleUploadSync}>
              <UploadCloud size={17} />
              上传到远端
            </button>
            <button className="secondary-button" type="button" disabled={syncBusy || syncLoading} onClick={handleDownloadSync}>
              <DownloadCloud size={17} />
              从远端拉取
            </button>
          </div>
          {syncConfig.lastSyncedAt && <p className="settings-message">上次同步：{formatSyncTime(syncConfig.lastSyncedAt)}</p>}
          {syncConfig.lastSyncMessage && <p className="settings-message">{syncConfig.lastSyncMessage}</p>}
          {syncConfig.lastSyncError && <p className="settings-message settings-error">{syncConfig.lastSyncError}</p>}
          {syncMessage && <p className="settings-message">{syncMessage}</p>}
        </section>
      </div>
    </section>
  );
}

function formatSyncTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
