import type { AppState, ExportFile, Folder, OpenFolderMode, OpenSavedTabMode, SavedTab, ThemeMode, Workspace } from "../types";
import { SCHEMA_VERSION } from "../types";
import { createId, nowIso } from "./id";
import { cloneDefaultSortViews } from "./sorting";
import { normalizeWorkspaceIconKey, pickDefaultWorkspaceIcon } from "./workspaceIcons";

export interface ImportSummary {
  source: "tab-loom" | "tabtab";
  workspaces: number;
  folders: number;
  tabs: number;
  skippedTabs: number;
}

export interface ImportAppendResult {
  state: AppState;
  summary: ImportSummary;
}

export function createExportText(state: AppState): string {
  const payload: ExportFile = {
    app: "tab-loom",
    exportedAt: nowIso(),
    state
  };

  return JSON.stringify(payload, null, 2);
}

export function parseImportedState(text: string): AppState {
  const parsed = parseJson(text);
  const state = migrateAppState(isRecord(parsed) && parsed.app === "tab-loom" ? parsed.state : parsed);
  assertAppState(state);
  return state;
}

export function appendImportedText(currentState: AppState, text: string): ImportAppendResult {
  const parsed = parseJson(text);
  if (isTabtabBackup(parsed)) {
    return appendTabtabBackup(currentState, parsed);
  }

  const importedState = migrateAppState(isRecord(parsed) && parsed.app === "tab-loom" ? parsed.state : parsed);
  assertAppState(importedState);
  return appendTabLoomState(currentState, importedState);
}

export function migrateAppState(value: unknown): AppState {
  if (!isRecord(value)) {
    throw new Error("导入数据必须是对象。");
  }

  if (![1, 2, 3, 4, SCHEMA_VERSION].includes(Number(value.schemaVersion))) {
    throw new Error(`不支持的数据版本：${String(value.schemaVersion)}`);
  }

  if (!isRecord(value.workspaces) || !isRecord(value.folders) || !isRecord(value.savedTabs)) {
    throw new Error("导入数据缺少工作区、文件夹或标签页集合。");
  }

  const rawSettings = isRecord(value.settings) ? value.settings : {};
  const schemaVersion = Number(value.schemaVersion);
  const settings = {
    activeWorkspaceId: typeof rawSettings.activeWorkspaceId === "string" ? rawSettings.activeWorkspaceId : "",
    themeMode: schemaVersion >= 3 ? normalizeThemeMode(rawSettings.themeMode, "system") : "light",
    openSavedTabMode: normalizeOpenSavedTabMode(rawSettings.openSavedTabMode, "new-tab"),
    showPinnedOpenTabs: typeof rawSettings.showPinnedOpenTabs === "boolean" ? rawSettings.showPinnedOpenTabs : true,
    openFolderMode: normalizeOpenFolderMode(rawSettings.openFolderMode, "direct")
  };

  const workspaces = Object.fromEntries(
    Object.entries(value.workspaces).map(([id, workspace], index) => [
      id,
      isRecord(workspace)
        ? {
            ...workspace,
            iconKey: normalizeWorkspaceIconKey(workspace.iconKey ?? pickDefaultWorkspaceIcon(index))
          }
        : workspace
    ])
  );

  const folders = Object.fromEntries(
    Object.entries(value.folders).map(([id, folder]) => {
      if (!isRecord(folder)) return [id, folder];
      const { tags: _ignoredTags, ...rest } = folder;
      return [id, rest];
    })
  );

  const savedTabs = Object.fromEntries(
    Object.entries(value.savedTabs).map(([id, tab]) => [
      id,
      isRecord(tab)
        ? {
            ...tab,
            tags: Array.isArray(tab.tags) ? tab.tags : []
          }
        : tab
    ])
  );

  return {
    ...(value as Omit<AppState, "schemaVersion" | "workspaces" | "folders" | "savedTabs" | "settings">),
    schemaVersion: SCHEMA_VERSION,
    workspaces: workspaces as AppState["workspaces"],
    folders: folders as AppState["folders"],
    savedTabs: savedTabs as AppState["savedTabs"],
    settings
  };
}

export function assertAppState(value: unknown): asserts value is AppState {
  if (!isRecord(value)) {
    throw new Error("导入数据必须是对象。");
  }

  if (value.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`不支持的数据版本：${String(value.schemaVersion)}`);
  }

  if (!isRecord(value.workspaces) || !isRecord(value.folders) || !isRecord(value.savedTabs)) {
    throw new Error("导入数据缺少工作区、文件夹或标签页集合。");
  }

  if (
    !isRecord(value.settings) ||
    typeof value.settings.activeWorkspaceId !== "string" ||
    !isThemeMode(value.settings.themeMode) ||
    !isOpenSavedTabMode(value.settings.openSavedTabMode) ||
    typeof value.settings.showPinnedOpenTabs !== "boolean" ||
    !isOpenFolderMode(value.settings.openFolderMode)
  ) {
    throw new Error("导入数据缺少有效的应用设置。");
  }

  const workspaces = value.workspaces as Record<string, unknown>;
  const folders = value.folders as Record<string, unknown>;
  const savedTabs = value.savedTabs as Record<string, unknown>;

  for (const [id, workspace] of Object.entries(workspaces)) {
    assertWorkspace(id, workspace);
  }

  for (const [id, folder] of Object.entries(folders)) {
    assertFolder(id, folder);
  }

  for (const [id, savedTab] of Object.entries(savedTabs)) {
    assertSavedTab(id, savedTab);
  }

  if (!workspaces[value.settings.activeWorkspaceId]) {
    throw new Error("当前工作区不存在。");
  }
}

function appendTabLoomState(currentState: AppState, importedState: AppState): ImportAppendResult {
  const timestamp = nowIso();
  const workspaces = { ...currentState.workspaces };
  const folders = { ...currentState.folders };
  const savedTabs = { ...currentState.savedTabs };
  const workspaceList = Object.values(importedState.workspaces).sort((left, right) => left.manualOrder - right.manualOrder);
  let importedFolderCount = 0;
  let importedTabCount = 0;
  let skippedTabs = 0;

  workspaceList.forEach((workspace, workspaceIndex) => {
    const workspaceId = createId("workspace");
    const folderIds: string[] = [];

    workspace.folderIds.forEach((sourceFolderId, folderIndex) => {
      const sourceFolder = importedState.folders[sourceFolderId];
      if (!sourceFolder) return;

      const folderId = createId("folder");
      const savedTabIds: string[] = [];
      sourceFolder.savedTabIds.forEach((sourceTabId, tabIndex) => {
        const sourceTab = importedState.savedTabs[sourceTabId];
        if (!sourceTab || !isValidHttpUrl(sourceTab.url)) {
          skippedTabs += 1;
          return;
        }
        const savedTabId = createId("tab");
        savedTabs[savedTabId] = {
          ...sourceTab,
          id: savedTabId,
          folderId,
          manualOrder: tabIndex,
          createdAt: sourceTab.createdAt || timestamp,
          updatedAt: sourceTab.updatedAt || timestamp
        };
        savedTabIds.push(savedTabId);
        importedTabCount += 1;
      });

      folders[folderId] = {
        ...sourceFolder,
        id: folderId,
        workspaceId,
        savedTabIds,
        manualOrder: folderIndex,
        createdAt: sourceFolder.createdAt || timestamp,
        updatedAt: sourceFolder.updatedAt || timestamp
      };
      folderIds.push(folderId);
      importedFolderCount += 1;
    });

    workspaces[workspaceId] = {
      ...workspace,
      id: workspaceId,
      folderIds,
      manualOrder: Object.keys(currentState.workspaces).length + workspaceIndex,
      createdAt: workspace.createdAt || timestamp,
      updatedAt: workspace.updatedAt || timestamp
    };
  });

  return {
    state: {
      ...currentState,
      workspaces,
      folders,
      savedTabs
    },
    summary: {
      source: "tab-loom",
      workspaces: workspaceList.length,
      folders: importedFolderCount,
      tabs: importedTabCount,
      skippedTabs
    }
  };
}

function appendTabtabBackup(currentState: AppState, backup: TabtabBackup): ImportAppendResult {
  const timestamp = nowIso();
  const workspaces = { ...currentState.workspaces };
  const folders = { ...currentState.folders };
  const savedTabs = { ...currentState.savedTabs };
  let importedFolderCount = 0;
  let importedTabCount = 0;
  let skippedTabs = 0;

  backup.space_list.forEach((space, workspaceIndex) => {
    const sourceSpace = backup.spaces[space.id] ?? space;
    const workspaceId = createId("workspace");
    const groups = Array.isArray(sourceSpace.groups) ? sourceSpace.groups : [];
    const folderIds: string[] = [];

    groups.forEach((group, folderIndex) => {
      if (!isRecord(group)) return;
      const folderId = createId("folder");
      const tabs = Array.isArray(group.tabs) ? group.tabs : [];
      const savedTabIds: string[] = [];

      tabs.forEach((tab) => {
        if (!isRecord(tab) || typeof tab.url !== "string" || !isValidHttpUrl(tab.url)) {
          skippedTabs += 1;
          return;
        }

        const savedTabId = createId("tab");
        const title = typeof tab.title === "string" && tab.title.trim() ? tab.title.trim() : tab.url;
        savedTabs[savedTabId] = {
          id: savedTabId,
          folderId,
          title,
          url: tab.url,
          favIconUrl: typeof tab.favIconUrl === "string" && isValidHttpUrl(tab.favIconUrl) ? tab.favIconUrl : undefined,
          tags: [],
          source: typeof tab.pinned === "boolean" ? { pinned: tab.pinned } : undefined,
          manualOrder: savedTabIds.length,
          createdAt: timestamp,
          updatedAt: timestamp
        };
        savedTabIds.push(savedTabId);
        importedTabCount += 1;
      });

      folders[folderId] = {
        id: folderId,
        workspaceId,
        name: typeof group.name === "string" && group.name.trim() ? group.name.trim() : `文件夹 ${folderIndex + 1}`,
        savedTabIds,
        sortViews: cloneDefaultSortViews(),
        activeSortViewId: "sort_manual",
        collapsed: false,
        manualOrder: folderIndex,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      folderIds.push(folderId);
      importedFolderCount += 1;
    });

    workspaces[workspaceId] = {
      id: workspaceId,
      name: typeof sourceSpace.name === "string" && sourceSpace.name.trim() ? sourceSpace.name.trim() : `工作区 ${workspaceIndex + 1}`,
      iconKey: pickDefaultWorkspaceIcon(Object.keys(currentState.workspaces).length + workspaceIndex),
      folderIds,
      manualOrder: Object.keys(currentState.workspaces).length + workspaceIndex,
      createdAt: timestamp,
      updatedAt: timestamp
    };
  });

  return {
    state: {
      ...currentState,
      workspaces,
      folders,
      savedTabs
    },
    summary: {
      source: "tabtab",
      workspaces: backup.space_list.length,
      folders: importedFolderCount,
      tabs: importedTabCount,
      skippedTabs
    }
  };
}

function assertWorkspace(id: string, value: unknown): asserts value is Workspace {
  if (
    !isRecord(value) ||
    value.id !== id ||
    typeof value.name !== "string" ||
    typeof value.iconKey !== "string" ||
    !Array.isArray(value.folderIds)
  ) {
    throw new Error(`工作区 ${id} 结构无效。`);
  }
}

function assertFolder(id: string, value: unknown): asserts value is Folder {
  if (
    !isRecord(value) ||
    value.id !== id ||
    typeof value.workspaceId !== "string" ||
    typeof value.name !== "string" ||
    !Array.isArray(value.savedTabIds) ||
    !Array.isArray(value.sortViews) ||
    typeof value.activeSortViewId !== "string"
  ) {
    throw new Error(`文件夹 ${id} 结构无效。`);
  }
}

function assertSavedTab(id: string, value: unknown): asserts value is SavedTab {
  if (
    !isRecord(value) ||
    value.id !== id ||
    typeof value.folderId !== "string" ||
    typeof value.title !== "string" ||
    typeof value.url !== "string" ||
    !Array.isArray(value.tags)
  ) {
    throw new Error(`标签页 ${id} 结构无效。`);
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("导入文件不是有效的 JSON。");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "black" || value === "system";
}

function normalizeThemeMode(value: unknown, fallback: ThemeMode): ThemeMode {
  return isThemeMode(value) ? value : fallback;
}

function isOpenSavedTabMode(value: unknown): value is OpenSavedTabMode {
  return value === "new-tab" || value === "current-tab";
}

function normalizeOpenSavedTabMode(value: unknown, fallback: OpenSavedTabMode): OpenSavedTabMode {
  return isOpenSavedTabMode(value) ? value : fallback;
}

function isOpenFolderMode(value: unknown): value is OpenFolderMode {
  return value === "direct" || value === "chrome-group";
}

function normalizeOpenFolderMode(value: unknown, fallback: OpenFolderMode): OpenFolderMode {
  return isOpenFolderMode(value) ? value : fallback;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

interface TabtabSpaceSummary {
  id: string;
  name?: string;
  groups?: unknown[];
}

interface TabtabBackup {
  version: number;
  space_list: TabtabSpaceSummary[];
  spaces: Record<string, TabtabSpaceSummary>;
}

function isTabtabBackup(value: unknown): value is TabtabBackup {
  if (!isRecord(value) || typeof value.version !== "number" || !Array.isArray(value.space_list) || !isRecord(value.spaces)) {
    return false;
  }

  return value.space_list.every((space) => isRecord(space) && typeof space.id === "string");
}
