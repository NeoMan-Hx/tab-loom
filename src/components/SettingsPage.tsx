import { ArrowLeft, ChevronRight, Cloud, Download, DownloadCloud, GitBranch, Moon, Monitor, Save, Sun, Upload, UploadCloud } from "lucide-react";
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
import type {
  AppState,
  ColorThemeKey,
  CustomThemeColorKey,
  FontFamilyKey,
  OpenFolderMode,
  OpenSavedTabMode,
  SavedTabCardDisplayMode,
  SavedTabTitleLineMode,
  ThemeMode
} from "../types";

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

const COLOR_THEME_OPTIONS: Array<{
  value: ColorThemeKey;
  label: string;
  description: string;
  swatches: [string, string, string];
}> = [
  { value: "vscode", label: "VS Code", description: "清爽蓝色强调，接近 VS Code 的编辑器气质。", swatches: ["#007acc", "#1f6feb", "#f6f8fa"] },
  { value: "darcula", label: "Darcula", description: "JetBrains 风格的琥珀强调和深灰层次。", swatches: ["#cc7832", "#a9b7c6", "#2b2b2b"] },
  { value: "one-dark", label: "One Dark", description: "Atom / One Dark 风格的紫蓝强调。", swatches: ["#61afef", "#c678dd", "#282c34"] },
  { value: "github", label: "GitHub Light", description: "类似 GitHub 编辑区的中性浅色和蓝色强调。", swatches: ["#0969da", "#6e7781", "#ffffff"] },
  { value: "solarized", label: "Solarized", description: "Solarized 的低对比青蓝与暖色背景。", swatches: ["#268bd2", "#859900", "#fdf6e3"] },
  { value: "nord", label: "Nord", description: "冷静的极地蓝灰，暗色模式下尤其柔和。", swatches: ["#88c0d0", "#5e81ac", "#2e3440"] }
];

const CUSTOM_THEME_COLOR_FIELDS: Array<{
  key: CustomThemeColorKey;
  label: string;
  description: string;
  defaultColor: string;
}> = [
  { key: "background", label: "页面背景", description: "--bg", defaultColor: "#f6f8fa" },
  { key: "backgroundGlow", label: "背景光感", description: "--bg-glow", defaultColor: "#ffffff" },
  { key: "surface", label: "基础面板", description: "--surface", defaultColor: "#ffffff" },
  { key: "surfaceSoft", label: "柔和面板", description: "--surface-soft", defaultColor: "#f1f4f8" },
  { key: "surfaceHover", label: "悬停背景", description: "--surface-hover", defaultColor: "#e9edf3" },
  { key: "surfaceSelected", label: "选中背景", description: "--surface-selected", defaultColor: "#e5f3ff" },
  { key: "line", label: "主分割线", description: "--line", defaultColor: "#d0d7de" },
  { key: "lineSoft", label: "弱分割线", description: "--line-soft", defaultColor: "#d8dee4" },
  { key: "text", label: "主文字", description: "--text", defaultColor: "#1f2328" },
  { key: "textSoft", label: "次级文字", description: "--text-soft", defaultColor: "#4d5764" },
  { key: "muted", label: "辅助文字", description: "--muted", defaultColor: "#6e7781" },
  { key: "accent", label: "强调色", description: "--accent", defaultColor: "#007acc" },
  { key: "accentStrong", label: "强调深色", description: "--accent-strong", defaultColor: "#0065a8" },
  { key: "accentSoft", label: "强调浅底", description: "--accent-soft", defaultColor: "#e5f3ff" },
  { key: "accentText", label: "强调文字", description: "--accent-text", defaultColor: "#075985" },
  { key: "topbar", label: "顶栏底色", description: "顶部命令栏", defaultColor: "#ffffff" },
  { key: "rightSidebar", label: "右侧栏底色", description: "已打开区域", defaultColor: "#f6f8fa" },
  { key: "rightSearch", label: "右侧搜索", description: "搜索框底色", defaultColor: "#ffffff" },
  { key: "savedCard", label: "标签卡片", description: "保存卡片底色", defaultColor: "#ffffff" },
  { key: "popover", label: "弹出菜单", description: "二级/三级菜单", defaultColor: "#ffffff" }
];

const OPEN_TAB_OPTIONS: Array<{ value: OpenSavedTabMode; label: string; description: string }> = [
  { value: "new-tab", label: "新标签页打开", description: "点击保存卡片时创建新的 Chrome 标签页。" },
  { value: "current-tab", label: "当前页跳转", description: "点击保存卡片时复用当前新标签页。" }
];

const OPEN_FOLDER_OPTIONS: Array<{ value: OpenFolderMode; label: string; description: string }> = [
  { value: "direct", label: "直接打开", description: "打开全部时只创建普通标签页。" },
  { value: "chrome-group", label: "Chrome 分组", description: "打开全部后尽量放进同一个 Chrome 标签组。" }
];

const CARD_DISPLAY_OPTIONS: Array<{ value: SavedTabCardDisplayMode; label: string; description: string }> = [
  { value: "title-link", label: "标题 + 链接", description: "卡片显示标题，并在第二行显示链接域名。" },
  { value: "title-only", label: "仅标题", description: "卡片只显示标题，适合更紧凑地浏览。" }
];

const TITLE_LINE_OPTIONS: Array<{ value: SavedTabTitleLineMode; label: string; description: string }> = [
  { value: "single", label: "单行标题", description: "标题超出时省略，卡片高度更稳定。" },
  { value: "double", label: "两行标题", description: "仅标题模式下允许标题换行显示两行。" }
];

const FONT_OPTIONS: Array<{ value: FontFamilyKey; label: string; description: string; sample: string }> = [
  { value: "system", label: "系统默认", description: "跟随 Windows / macOS 的默认界面字体。", sample: "Tab 标签" },
  { value: "modern-sans", label: "现代黑体", description: "优先使用 Noto / 思源一类清晰黑体。", sample: "清晰工作台" },
  { value: "rounded", label: "圆润字体", description: "更柔和的圆体风格，适合轻松浏览。", sample: "柔和卡片" },
  { value: "serif", label: "阅读宋体", description: "偏阅读感的宋体/衬线字体栈。", sample: "资料归档" },
  { value: "mono", label: "等宽字体", description: "适合代码、文档和链接较多的工作区。", sample: "dev/docs" }
];

export function SettingsPage({ state, dispatch, onBack }: SettingsPageProps) {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [settingsView, setSettingsView] = useState<"main" | "custom-theme">("main");
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

  const accentField = CUSTOM_THEME_COLOR_FIELDS.find((field) => field.key === "accent")!;
  const accentColor = state.settings.customThemeColors.accent ?? accentField.defaultColor;
  const setCustomThemeColor = (colorKey: CustomThemeColorKey, color: string) => {
    if (!state.settings.customThemeEnabled) {
      dispatch({ type: "setCustomThemeEnabled", enabled: true });
    }
    dispatch({ type: "setCustomThemeColor", colorKey, color });
  };

  if (settingsView === "custom-theme") {
    return (
      <section className="settings-page" aria-label="自定义主题">
        <div className="settings-heading">
          <button className="secondary-button" type="button" onClick={() => setSettingsView("main")}>
            <ArrowLeft size={16} />
            返回设置
          </button>
          <div>
            <p className="eyebrow">Appearance</p>
            <h2>自定义主题</h2>
          </div>
        </div>

        <div className="settings-grid">
          <section className="settings-panel settings-panel-wide custom-theme-detail-panel">
            <div className="settings-panel-heading">
              <h3>模块颜色</h3>
              <p>这里放更细的颜色覆盖项。未设置的颜色会继续跟随当前 IDE 主题预设。</p>
            </div>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={state.settings.customThemeEnabled}
                onChange={(event) => dispatch({ type: "setCustomThemeEnabled", enabled: event.target.checked })}
              />
              <span>
                启用自定义颜色
                <small>关闭后不会清空颜色，只是临时回到主题预设。</small>
              </span>
            </label>
            <div className="custom-theme-grid">
              {CUSTOM_THEME_COLOR_FIELDS.map((field) => (
                <label className="custom-color-field" key={field.key}>
                  <input
                    type="color"
                    value={state.settings.customThemeColors[field.key] ?? field.defaultColor}
                    disabled={!state.settings.customThemeEnabled}
                    onChange={(event) => dispatch({ type: "setCustomThemeColor", colorKey: field.key, color: event.target.value })}
                  />
                  <span>
                    {field.label}
                    <small>{field.description}</small>
                  </span>
                </label>
              ))}
            </div>
            <div className="settings-actions">
              <button className="secondary-button" type="button" onClick={() => dispatch({ type: "resetCustomThemeColors" })}>
                恢复主题默认颜色
              </button>
            </div>
          </section>
        </div>
      </section>
    );
  }

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
            <h3>自定义主题</h3>
            <p>主界面只保留重点色，细节颜色放到二级页面。</p>
          </div>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={state.settings.customThemeEnabled}
              onChange={(event) => dispatch({ type: "setCustomThemeEnabled", enabled: event.target.checked })}
            />
            <span>
              启用自定义颜色
              <small>关闭后回到当前 IDE 主题预设。</small>
            </span>
          </label>
          <label className="custom-accent-field">
            <input
              type="color"
              value={accentColor}
              onChange={(event) => setCustomThemeColor("accent", event.target.value)}
            />
            <span>
              重点色
              <small>{accentColor}</small>
            </span>
          </label>
          <div className="settings-actions">
            <button className="secondary-button custom-theme-link" type="button" onClick={() => setSettingsView("custom-theme")}>
              细节颜色
              <ChevronRight size={16} />
            </button>
          </div>
        </section>

        <section className="settings-panel">
          <div className="settings-panel-heading">
            <h3>IDE 主题</h3>
            <p>选择参考常见 IDE 的配色预设。</p>
          </div>
          <div className="settings-option-list color-theme-list">
            {COLOR_THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={state.settings.colorThemeKey === option.value ? "settings-option selected color-theme-option" : "settings-option color-theme-option"}
                type="button"
                onClick={() => dispatch({ type: "setColorTheme", colorThemeKey: option.value })}
              >
                <span>{option.label}</span>
                <div className="color-theme-swatches" aria-hidden="true">
                  {option.swatches.map((color) => (
                    <i key={color} style={{ background: color }} />
                  ))}
                </div>
                <small>{option.description}</small>
              </button>
            ))}
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
            <h3>字体</h3>
            <p>选择整个工作台使用的字体风格。</p>
          </div>
          <div className="settings-option-list font-option-list">
            {FONT_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={state.settings.fontFamilyKey === option.value ? "settings-option selected font-option" : "settings-option font-option"}
                type="button"
                data-font-preview={option.value}
                onClick={() => dispatch({ type: "setFontFamily", fontFamilyKey: option.value })}
              >
                <span>{option.label}</span>
                <strong>{option.sample}</strong>
                <small>{option.description}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="settings-panel">
          <div className="settings-panel-heading">
            <h3>卡片显示</h3>
            <p>控制工作区内保存标签页卡片的信息密度。</p>
          </div>
          <div className="settings-option-list">
            {CARD_DISPLAY_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={state.settings.savedTabCardDisplayMode === option.value ? "settings-option selected" : "settings-option"}
                type="button"
                onClick={() => dispatch({ type: "setSavedTabCardDisplayMode", mode: option.value })}
              >
                <span>{option.label}</span>
                <small>{option.description}</small>
              </button>
            ))}
          </div>
          {state.settings.savedTabCardDisplayMode === "title-only" && (
            <div className="settings-option-list">
              {TITLE_LINE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={state.settings.savedTabTitleLineMode === option.value ? "settings-option selected" : "settings-option"}
                  type="button"
                  onClick={() => dispatch({ type: "setSavedTabTitleLineMode", mode: option.value })}
                >
                  <span>{option.label}</span>
                  <small>{option.description}</small>
                </button>
              ))}
            </div>
          )}
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
