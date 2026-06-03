import { ArrowLeft, Download, Moon, Monitor, Sun, Upload } from "lucide-react";
import type { ChangeEvent, Dispatch } from "react";
import { useMemo, useRef, useState } from "react";
import type { AppAction } from "../state/appState";
import { appendImportedText, createExportText } from "../services/importExport";
import type { AppState, OpenFolderMode, OpenSavedTabMode, ThemeMode } from "../types";

interface SettingsPageProps {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  onBack: () => void;
}

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; description: string; icon: typeof Sun }> = [
  { value: "light", label: "白天", description: "始终使用明亮界面", icon: Sun },
  { value: "dark", label: "夜间", description: "使用现有深色界面", icon: Moon },
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
      </div>
    </section>
  );
}
