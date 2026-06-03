export const SCHEMA_VERSION = 5;

export type EntityId = string;

export type SortKey = "manual" | "title" | "domain" | "createdAt" | "updatedAt";
export type SortDirection = "asc" | "desc";
export type ThemeMode = "light" | "dark" | "black" | "system";
export type OpenSavedTabMode = "new-tab" | "current-tab";
export type OpenFolderMode = "direct" | "chrome-group";
export type WorkspaceIconKey =
  | "briefcase"
  | "code"
  | "palette"
  | "book-open"
  | "rocket"
  | "star"
  | "globe"
  | "folder"
  | "search"
  | "archive"
  | "settings"
  | "pin";

export interface SortView {
  id: EntityId;
  name: string;
  key: SortKey;
  direction: SortDirection;
}

export interface SavedTabSource {
  tabId?: number;
  windowId?: number;
  groupId?: number;
  pinned?: boolean;
}

export interface SavedTab {
  id: EntityId;
  folderId: EntityId;
  title: string;
  url: string;
  favIconUrl?: string;
  tags: string[];
  source?: SavedTabSource;
  manualOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: EntityId;
  workspaceId: EntityId;
  name: string;
  savedTabIds: EntityId[];
  sortViews: SortView[];
  activeSortViewId: EntityId;
  collapsed: boolean;
  manualOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: EntityId;
  name: string;
  iconKey: WorkspaceIconKey;
  folderIds: EntityId[];
  manualOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  activeWorkspaceId: EntityId;
  themeMode: ThemeMode;
  openSavedTabMode: OpenSavedTabMode;
  showPinnedOpenTabs: boolean;
  openFolderMode: OpenFolderMode;
}

export interface AppState {
  schemaVersion: typeof SCHEMA_VERSION;
  workspaces: Record<EntityId, Workspace>;
  folders: Record<EntityId, Folder>;
  savedTabs: Record<EntityId, SavedTab>;
  settings: AppSettings;
}

export interface ChromeOpenTab {
  id: number;
  windowId: number;
  groupId: number;
  index: number;
  title: string;
  url: string;
  favIconUrl?: string;
  pinned: boolean;
  active: boolean;
}

export interface OpenTabGroup {
  id: string;
  title: string;
  subtitle?: string;
  color?: string;
  groupId?: number;
  windowId?: number;
  isUngrouped: boolean;
  tabs: ChromeOpenTab[];
}

export interface ExportFile {
  app: "tab-loom";
  exportedAt: string;
  state: AppState;
}
