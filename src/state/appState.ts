import type {
  AppState,
  ChromeOpenTab,
  EntityId,
  Folder,
  OpenFolderMode,
  OpenSavedTabMode,
  SavedTab,
  ThemeMode,
  Workspace,
  WorkspaceIconKey
} from "../types";
import { SCHEMA_VERSION } from "../types";
import { createId, nowIso } from "../services/id";
import { cloneDefaultSortViews } from "../services/sorting";
import { DEFAULT_WORKSPACE_ICON, pickDefaultWorkspaceIcon } from "../services/workspaceIcons";

export type AppAction =
  | { type: "replaceState"; state: AppState }
  | { type: "createWorkspace"; name: string }
  | { type: "renameWorkspace"; workspaceId: EntityId; name: string }
  | { type: "setWorkspaceIcon"; workspaceId: EntityId; iconKey: WorkspaceIconKey }
  | { type: "deleteWorkspace"; workspaceId: EntityId }
  | { type: "setActiveWorkspace"; workspaceId: EntityId }
  | { type: "setThemeMode"; themeMode: ThemeMode }
  | { type: "setOpenSavedTabMode"; mode: OpenSavedTabMode }
  | { type: "setShowPinnedOpenTabs"; showPinned: boolean }
  | { type: "setOpenFolderMode"; mode: OpenFolderMode }
  | { type: "reorderWorkspaces"; orderedWorkspaceIds: EntityId[] }
  | { type: "createFolder"; workspaceId: EntityId; name: string }
  | { type: "createFolderFromOpenTabs"; workspaceId: EntityId; name: string; tabs: ChromeOpenTab[] }
  | { type: "renameFolder"; folderId: EntityId; name: string }
  | { type: "moveFolderToWorkspace"; folderId: EntityId; targetWorkspaceId: EntityId }
  | { type: "reorderFolders"; workspaceId: EntityId; orderedFolderIds: EntityId[] }
  | { type: "deleteFolder"; folderId: EntityId }
  | { type: "toggleFolder"; folderId: EntityId }
  | { type: "setFolderSort"; folderId: EntityId; sortViewId: EntityId }
  | { type: "saveOpenTab"; folderId: EntityId; tab: ChromeOpenTab; targetIndex?: number }
  | { type: "updateSavedTab"; savedTabId: EntityId; patch: Pick<SavedTab, "title" | "url"> & { favIconUrl?: string } }
  | { type: "deleteSavedTab"; savedTabId: EntityId }
  | { type: "moveSavedTab"; folderId: EntityId; savedTabId: EntityId; direction: "up" | "down" }
  | { type: "reorderSavedTabs"; folderId: EntityId; orderedSavedTabIds: EntityId[] }
  | { type: "moveSavedTabToFolder"; savedTabId: EntityId; targetFolderId: EntityId; targetIndex: number };

export function createDefaultState(): AppState {
  const createdAt = nowIso();
  const workspaceId = createId("workspace");
  const inboxId = createId("folder");
  const readingId = createId("folder");

  return {
    schemaVersion: SCHEMA_VERSION,
    workspaces: {
      [workspaceId]: {
        id: workspaceId,
        name: "工作台",
        iconKey: DEFAULT_WORKSPACE_ICON,
        folderIds: [inboxId, readingId],
        manualOrder: 0,
        createdAt,
        updatedAt: createdAt
      }
    },
    folders: {
      [inboxId]: createFolderRecord(inboxId, workspaceId, "收件箱", 0, createdAt),
      [readingId]: createFolderRecord(readingId, workspaceId, "稍后阅读", 1, createdAt)
    },
    savedTabs: {},
    settings: {
      activeWorkspaceId: workspaceId,
      themeMode: "system",
      openSavedTabMode: "new-tab",
      showPinnedOpenTabs: true,
      openFolderMode: "direct"
    }
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "replaceState":
      return action.state;

    case "createWorkspace":
      return createWorkspace(state, action.name);

    case "renameWorkspace":
      return renameWorkspace(state, action.workspaceId, action.name);

    case "setWorkspaceIcon":
      return setWorkspaceIcon(state, action.workspaceId, action.iconKey);

    case "deleteWorkspace":
      return deleteWorkspace(state, action.workspaceId);

    case "setActiveWorkspace":
      return state.workspaces[action.workspaceId]
        ? { ...state, settings: { ...state.settings, activeWorkspaceId: action.workspaceId } }
        : state;

    case "setThemeMode":
      return setThemeMode(state, action.themeMode);

    case "setOpenSavedTabMode":
      return setOpenSavedTabMode(state, action.mode);

    case "setShowPinnedOpenTabs":
      return {
        ...state,
        settings: { ...state.settings, showPinnedOpenTabs: action.showPinned }
      };

    case "setOpenFolderMode":
      return setOpenFolderMode(state, action.mode);

    case "reorderWorkspaces":
      return reorderWorkspaces(state, action.orderedWorkspaceIds);

    case "createFolder":
      return createFolder(state, action.workspaceId, action.name);

    case "createFolderFromOpenTabs":
      return createFolderFromOpenTabs(state, action.workspaceId, action.name, action.tabs);

    case "renameFolder":
      return renameFolder(state, action.folderId, action.name);

    case "moveFolderToWorkspace":
      return moveFolderToWorkspace(state, action.folderId, action.targetWorkspaceId);

    case "reorderFolders":
      return reorderFolders(state, action.workspaceId, action.orderedFolderIds);

    case "deleteFolder":
      return deleteFolder(state, action.folderId);

    case "toggleFolder":
      return updateFolder(state, action.folderId, (folder) => ({ ...folder, collapsed: !folder.collapsed }));

    case "setFolderSort":
      return updateFolder(state, action.folderId, (folder) =>
        folder.sortViews.some((view) => view.id === action.sortViewId)
          ? { ...folder, activeSortViewId: action.sortViewId, updatedAt: nowIso() }
          : folder
      );

    case "saveOpenTab":
      return saveOpenTab(state, action.folderId, action.tab, action.targetIndex);

    case "updateSavedTab":
      return updateSavedTabFields(state, action.savedTabId, action.patch);

    case "deleteSavedTab":
      return deleteSavedTab(state, action.savedTabId);

    case "moveSavedTab":
      return moveSavedTab(state, action.folderId, action.savedTabId, action.direction);

    case "reorderSavedTabs":
      return reorderSavedTabs(state, action.folderId, action.orderedSavedTabIds);

    case "moveSavedTabToFolder":
      return moveSavedTabToFolder(state, action.savedTabId, action.targetFolderId, action.targetIndex);
  }
}

export function createSavedTabFromOpenTab(folder: Folder, tab: ChromeOpenTab, createdAt = nowIso()): SavedTab {
  return createSavedTabRecord(folder.id, tab, folder.savedTabIds.length, createdAt);
}

function createFolderRecord(
  id: EntityId,
  workspaceId: EntityId,
  name: string,
  manualOrder: number,
  createdAt: string
): Folder {
  return {
    id,
    workspaceId,
    name,
    savedTabIds: [],
    sortViews: cloneDefaultSortViews(),
    activeSortViewId: "sort_manual",
    collapsed: false,
    manualOrder,
    createdAt,
    updatedAt: createdAt
  };
}

function createSavedTabRecord(folderId: EntityId, tab: ChromeOpenTab, manualOrder: number, createdAt: string): SavedTab {
  return {
    id: createId("tab"),
    folderId,
    title: tab.title || tab.url,
    url: tab.url,
    favIconUrl: tab.favIconUrl,
    tags: [],
    source: {
      tabId: tab.id,
      windowId: tab.windowId,
      groupId: tab.groupId,
      pinned: tab.pinned
    },
    manualOrder,
    createdAt,
    updatedAt: createdAt
  };
}

function setThemeMode(state: AppState, themeMode: ThemeMode): AppState {
  if (!["light", "dark", "black", "system"].includes(themeMode)) return state;
  return {
    ...state,
    settings: {
      ...state.settings,
      themeMode
    }
  };
}

function setOpenSavedTabMode(state: AppState, mode: OpenSavedTabMode): AppState {
  if (mode !== "new-tab" && mode !== "current-tab") return state;
  return {
    ...state,
    settings: {
      ...state.settings,
      openSavedTabMode: mode
    }
  };
}

function setOpenFolderMode(state: AppState, mode: OpenFolderMode): AppState {
  if (mode !== "direct" && mode !== "chrome-group") return state;
  return {
    ...state,
    settings: {
      ...state.settings,
      openFolderMode: mode
    }
  };
}

function reorderWorkspaces(state: AppState, orderedWorkspaceIds: EntityId[]): AppState {
  const existingIds = new Set(Object.keys(state.workspaces));
  const nextIds = orderedWorkspaceIds.filter((id) => existingIds.has(id));
  if (nextIds.length !== existingIds.size) return state;

  const timestamp = nowIso();
  const workspaces = { ...state.workspaces };
  nextIds.forEach((id, index) => {
    const workspace = workspaces[id];
    if (workspace) {
      workspaces[id] = { ...workspace, manualOrder: index, updatedAt: timestamp };
    }
  });

  return { ...state, workspaces };
}

function createWorkspace(state: AppState, name: string): AppState {
  const trimmed = name.trim();
  if (!trimmed) return state;

  const createdAt = nowIso();
  const workspaceId = createId("workspace");
  const folderId = createId("folder");
  const workspaceCount = Object.keys(state.workspaces).length;

  const workspace: Workspace = {
    id: workspaceId,
    name: trimmed,
    iconKey: pickDefaultWorkspaceIcon(workspaceCount),
    folderIds: [folderId],
    manualOrder: workspaceCount,
    createdAt,
    updatedAt: createdAt
  };

  return {
    ...state,
    workspaces: { ...state.workspaces, [workspaceId]: workspace },
    folders: {
      ...state.folders,
      [folderId]: createFolderRecord(folderId, workspaceId, "收件箱", 0, createdAt)
    },
    settings: { ...state.settings, activeWorkspaceId: workspaceId }
  };
}

function setWorkspaceIcon(state: AppState, workspaceId: EntityId, iconKey: WorkspaceIconKey): AppState {
  const workspace = state.workspaces[workspaceId];
  if (!workspace) return state;

  return {
    ...state,
    workspaces: {
      ...state.workspaces,
      [workspaceId]: { ...workspace, iconKey, updatedAt: nowIso() }
    }
  };
}

function renameWorkspace(state: AppState, workspaceId: EntityId, name: string): AppState {
  const workspace = state.workspaces[workspaceId];
  const trimmed = name.trim();
  if (!workspace || !trimmed) return state;

  return {
    ...state,
    workspaces: {
      ...state.workspaces,
      [workspaceId]: { ...workspace, name: trimmed, updatedAt: nowIso() }
    }
  };
}

function deleteWorkspace(state: AppState, workspaceId: EntityId): AppState {
  const workspace = state.workspaces[workspaceId];
  if (!workspace || Object.keys(state.workspaces).length === 1) return state;

  const workspaces = { ...state.workspaces };
  const folders = { ...state.folders };
  const savedTabs = { ...state.savedTabs };
  delete workspaces[workspaceId];

  for (const folderId of workspace.folderIds) {
    const folder = folders[folderId];
    if (!folder) continue;
    for (const tabId of folder.savedTabIds) {
      delete savedTabs[tabId];
    }
    delete folders[folderId];
  }

  const nextWorkspaces = normalizeWorkspaceOrders(workspaces);
  const nextActiveWorkspaceId =
    state.settings.activeWorkspaceId === workspaceId
      ? Object.values(nextWorkspaces).sort((a, b) => a.manualOrder - b.manualOrder)[0]?.id
      : state.settings.activeWorkspaceId;

  return {
    ...state,
    workspaces: nextWorkspaces,
    folders,
    savedTabs,
    settings: { ...state.settings, activeWorkspaceId: nextActiveWorkspaceId }
  };
}

function createFolder(state: AppState, workspaceId: EntityId, name: string): AppState {
  const workspace = state.workspaces[workspaceId];
  const trimmed = name.trim();
  if (!workspace || !trimmed) return state;

  const createdAt = nowIso();
  const folderId = createId("folder");

  return {
    ...state,
    workspaces: {
      ...state.workspaces,
      [workspaceId]: {
        ...workspace,
        folderIds: [...workspace.folderIds, folderId],
        updatedAt: createdAt
      }
    },
    folders: {
      ...state.folders,
      [folderId]: createFolderRecord(folderId, workspaceId, trimmed, workspace.folderIds.length, createdAt)
    }
  };
}

function createFolderFromOpenTabs(state: AppState, workspaceId: EntityId, name: string, tabs: ChromeOpenTab[]): AppState {
  const workspace = state.workspaces[workspaceId];
  const trimmed = name.trim();
  const openTabs = tabs.filter((tab) => tab.url);
  if (!workspace || !trimmed || openTabs.length === 0) return state;

  const createdAt = nowIso();
  const folderId = createId("folder");
  const folder = createFolderRecord(folderId, workspaceId, trimmed, workspace.folderIds.length, createdAt);
  const savedTabs = { ...state.savedTabs };
  const savedTabIds: EntityId[] = [];

  openTabs.forEach((tab, index) => {
    const savedTab = createSavedTabRecord(folderId, tab, index, createdAt);
    savedTabs[savedTab.id] = savedTab;
    savedTabIds.push(savedTab.id);
  });

  return {
    ...state,
    workspaces: {
      ...state.workspaces,
      [workspaceId]: {
        ...workspace,
        folderIds: [...workspace.folderIds, folderId],
        updatedAt: createdAt
      }
    },
    folders: {
      ...state.folders,
      [folderId]: {
        ...folder,
        savedTabIds,
        updatedAt: createdAt
      }
    },
    savedTabs
  };
}

function renameFolder(state: AppState, folderId: EntityId, name: string): AppState {
  const trimmed = name.trim();
  if (!trimmed) return state;
  return updateFolder(state, folderId, (folder) => ({ ...folder, name: trimmed, updatedAt: nowIso() }));
}

function moveFolderToWorkspace(state: AppState, folderId: EntityId, targetWorkspaceId: EntityId): AppState {
  const folder = state.folders[folderId];
  const sourceWorkspace = folder ? state.workspaces[folder.workspaceId] : undefined;
  const targetWorkspace = state.workspaces[targetWorkspaceId];
  if (!folder || !sourceWorkspace || !targetWorkspace || sourceWorkspace.id === targetWorkspace.id) return state;

  const timestamp = nowIso();
  const sourceFolderIds = sourceWorkspace.folderIds.filter((id) => id !== folderId);
  const targetFolderIds = [...targetWorkspace.folderIds, folderId];
  const folders = { ...state.folders };
  folders[folderId] = {
    ...folder,
    workspaceId: targetWorkspaceId,
    manualOrder: targetFolderIds.length - 1,
    updatedAt: timestamp
  };

  normalizeFolderManualOrders(folders, sourceFolderIds);
  normalizeFolderManualOrders(folders, targetFolderIds);

  return {
    ...state,
    folders,
    workspaces: {
      ...state.workspaces,
      [sourceWorkspace.id]: {
        ...sourceWorkspace,
        folderIds: sourceFolderIds,
        updatedAt: timestamp
      },
      [targetWorkspace.id]: {
        ...targetWorkspace,
        folderIds: targetFolderIds,
        updatedAt: timestamp
      }
    }
  };
}

function reorderFolders(state: AppState, workspaceId: EntityId, orderedFolderIds: EntityId[]): AppState {
  const workspace = state.workspaces[workspaceId];
  if (!workspace) return state;

  const existingIds = new Set(workspace.folderIds);
  const nextIds = orderedFolderIds.filter((id) => existingIds.has(id));
  if (nextIds.length !== workspace.folderIds.length) return state;

  const timestamp = nowIso();
  const folders = { ...state.folders };
  normalizeFolderManualOrders(folders, nextIds);

  return {
    ...state,
    folders,
    workspaces: {
      ...state.workspaces,
      [workspaceId]: {
        ...workspace,
        folderIds: nextIds,
        updatedAt: timestamp
      }
    }
  };
}

function deleteFolder(state: AppState, folderId: EntityId): AppState {
  const folder = state.folders[folderId];
  const workspace = folder ? state.workspaces[folder.workspaceId] : undefined;
  if (!folder || !workspace || workspace.folderIds.length === 1) return state;

  const folders = { ...state.folders };
  const savedTabs = { ...state.savedTabs };
  delete folders[folderId];

  for (const tabId of folder.savedTabIds) {
    delete savedTabs[tabId];
  }

  const nextFolderIds = workspace.folderIds.filter((id) => id !== folderId);
  normalizeFolderManualOrders(folders, nextFolderIds);

  return {
    ...state,
    folders,
    savedTabs,
    workspaces: {
      ...state.workspaces,
      [workspace.id]: {
        ...workspace,
        folderIds: nextFolderIds,
        updatedAt: nowIso()
      }
    }
  };
}

function saveOpenTab(state: AppState, folderId: EntityId, tab: ChromeOpenTab, targetIndex?: number): AppState {
  const folder = state.folders[folderId];
  if (!folder || !tab.url) return state;

  const nextIndex = clampIndex(targetIndex ?? folder.savedTabIds.length, folder.savedTabIds.length);
  const savedTab = createSavedTabFromOpenTab(folder, tab);
  const savedTabIds = [...folder.savedTabIds];
  savedTabIds.splice(nextIndex, 0, savedTab.id);
  const nextFolder = {
    ...folder,
    savedTabIds,
    updatedAt: savedTab.createdAt
  };

  return normalizeSavedTabOrders({
    ...state,
    folders: {
      ...state.folders,
      [folderId]: nextFolder
    },
    savedTabs: {
      ...state.savedTabs,
      [savedTab.id]: savedTab
    }
  }, [folderId]);
}

function deleteSavedTab(state: AppState, savedTabId: EntityId): AppState {
  const savedTab = state.savedTabs[savedTabId];
  const folder = savedTab ? state.folders[savedTab.folderId] : undefined;
  if (!savedTab || !folder) return state;

  const savedTabs = { ...state.savedTabs };
  delete savedTabs[savedTabId];

  return normalizeSavedTabOrders({
    ...state,
    savedTabs,
    folders: {
      ...state.folders,
      [folder.id]: {
        ...folder,
        savedTabIds: folder.savedTabIds.filter((id) => id !== savedTabId),
        updatedAt: nowIso()
      }
    }
  }, [folder.id]);
}

function updateSavedTabFields(
  state: AppState,
  savedTabId: EntityId,
  patch: Pick<SavedTab, "title" | "url"> & { favIconUrl?: string }
): AppState {
  const savedTab = state.savedTabs[savedTabId];
  const title = patch.title.trim();
  const url = patch.url.trim();
  const favIconUrl = patch.favIconUrl?.trim();

  if (!savedTab || !title || !isValidHttpUrl(url) || (favIconUrl && !isValidHttpUrl(favIconUrl))) {
    return state;
  }

  return {
    ...state,
    savedTabs: {
      ...state.savedTabs,
      [savedTabId]: {
        ...savedTab,
        title,
        url,
        favIconUrl: favIconUrl || undefined,
        updatedAt: nowIso()
      }
    }
  };
}

function reorderSavedTabs(state: AppState, folderId: EntityId, orderedSavedTabIds: EntityId[]): AppState {
  const folder = state.folders[folderId];
  if (!folder) return state;

  const existingIds = new Set(folder.savedTabIds);
  const nextIds = orderedSavedTabIds.filter((id) => existingIds.has(id));
  if (nextIds.length !== folder.savedTabIds.length) return state;

  return normalizeSavedTabOrders({
    ...state,
    folders: {
      ...state.folders,
      [folderId]: {
        ...folder,
        savedTabIds: nextIds,
        activeSortViewId: "sort_manual",
        updatedAt: nowIso()
      }
    }
  }, [folderId]);
}

function moveSavedTabToFolder(
  state: AppState,
  savedTabId: EntityId,
  targetFolderId: EntityId,
  targetIndex: number
): AppState {
  const savedTab = state.savedTabs[savedTabId];
  const sourceFolder = savedTab ? state.folders[savedTab.folderId] : undefined;
  const targetFolder = state.folders[targetFolderId];
  if (!savedTab || !sourceFolder || !targetFolder) return state;

  const timestamp = nowIso();
  const folders = { ...state.folders };
  const savedTabs = { ...state.savedTabs };

  if (sourceFolder.id === targetFolder.id) {
    const withoutDragged = sourceFolder.savedTabIds.filter((id) => id !== savedTabId);
    const nextIndex = clampIndex(targetIndex, withoutDragged.length);
    const nextIds = [...withoutDragged.slice(0, nextIndex), savedTabId, ...withoutDragged.slice(nextIndex)];
    folders[sourceFolder.id] = {
      ...sourceFolder,
      savedTabIds: nextIds,
      activeSortViewId: "sort_manual",
      updatedAt: timestamp
    };
    return normalizeSavedTabOrders({ ...state, folders, savedTabs }, [sourceFolder.id], timestamp);
  }

  const targetIds = [...targetFolder.savedTabIds];
  const nextIndex = clampIndex(targetIndex, targetIds.length);
  targetIds.splice(nextIndex, 0, savedTabId);

  folders[sourceFolder.id] = {
    ...sourceFolder,
    savedTabIds: sourceFolder.savedTabIds.filter((id) => id !== savedTabId),
    activeSortViewId: "sort_manual",
    updatedAt: timestamp
  };
  folders[targetFolder.id] = {
    ...targetFolder,
    savedTabIds: targetIds,
    activeSortViewId: "sort_manual",
    updatedAt: timestamp
  };
  savedTabs[savedTabId] = {
    ...savedTab,
    folderId: targetFolder.id,
    updatedAt: timestamp
  };

  return normalizeSavedTabOrders({ ...state, folders, savedTabs }, [sourceFolder.id, targetFolder.id], timestamp);
}

function moveSavedTab(
  state: AppState,
  folderId: EntityId,
  savedTabId: EntityId,
  direction: "up" | "down"
): AppState {
  const folder = state.folders[folderId];
  if (!folder) return state;

  const currentIndex = folder.savedTabIds.indexOf(savedTabId);
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= folder.savedTabIds.length) return state;

  const ids = [...folder.savedTabIds];
  [ids[currentIndex], ids[targetIndex]] = [ids[targetIndex], ids[currentIndex]];
  return reorderSavedTabs(state, folderId, ids);
}

function updateFolder(state: AppState, folderId: EntityId, updater: (folder: Folder) => Folder): AppState {
  const folder = state.folders[folderId];
  if (!folder) return state;

  return {
    ...state,
    folders: {
      ...state.folders,
      [folderId]: updater(folder)
    }
  };
}

function normalizeSavedTabOrders(state: AppState, folderIds: EntityId[], timestamp = nowIso()): AppState {
  const savedTabs = { ...state.savedTabs };
  for (const folderId of folderIds) {
    const folder = state.folders[folderId];
    if (!folder) continue;
    folder.savedTabIds.forEach((id, index) => {
      const tab = savedTabs[id];
      if (tab) {
        savedTabs[id] = {
          ...tab,
          folderId,
          manualOrder: index,
          updatedAt: timestamp
        };
      }
    });
  }
  return { ...state, savedTabs };
}

function normalizeFolderManualOrders(folders: Record<EntityId, Folder>, folderIds: EntityId[]): void {
  folderIds.forEach((id, index) => {
    const folder = folders[id];
    if (folder) {
      folders[id] = { ...folder, manualOrder: index };
    }
  });
}

function normalizeWorkspaceOrders(workspaces: Record<EntityId, Workspace>): Record<EntityId, Workspace> {
  return Object.fromEntries(
    Object.values(workspaces)
      .sort((left, right) => left.manualOrder - right.manualOrder)
      .map((workspace, index) => [workspace.id, { ...workspace, manualOrder: index }])
  );
}

function clampIndex(index: number, maxLength: number): number {
  if (!Number.isFinite(index)) return maxLength;
  return Math.max(0, Math.min(Math.trunc(index), maxLength));
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
