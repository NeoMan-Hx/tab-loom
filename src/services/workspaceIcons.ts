import type { WorkspaceIconKey } from "../types";

export const DEFAULT_WORKSPACE_ICON: WorkspaceIconKey = "briefcase";

export const WORKSPACE_ICON_OPTIONS: Array<{ key: WorkspaceIconKey; label: string }> = [
  { key: "briefcase", label: "Briefcase" },
  { key: "code", label: "Code" },
  { key: "palette", label: "Palette" },
  { key: "book-open", label: "Book" },
  { key: "rocket", label: "Rocket" },
  { key: "star", label: "Star" },
  { key: "globe", label: "Globe" },
  { key: "folder", label: "Folder" },
  { key: "search", label: "Search" },
  { key: "archive", label: "Archive" },
  { key: "settings", label: "Settings" },
  { key: "pin", label: "Pin" },
  { key: "home", label: "Home" },
  { key: "laptop", label: "Laptop" },
  { key: "terminal", label: "Terminal" },
  { key: "database", label: "Database" },
  { key: "cpu", label: "CPU" },
  { key: "calendar", label: "Calendar" },
  { key: "mail", label: "Mail" },
  { key: "camera", label: "Camera" },
  { key: "music", label: "Music" },
  { key: "gamepad", label: "Gamepad" },
  { key: "heart", label: "Heart" },
  { key: "coffee", label: "Coffee" },
  { key: "lightbulb", label: "Lightbulb" },
  { key: "users", label: "Users" },
  { key: "shield", label: "Shield" },
  { key: "cloud", label: "Cloud" },
  { key: "layers", label: "Layers" },
  { key: "bookmark", label: "Bookmark" },
  { key: "wrench", label: "Wrench" },
  { key: "hammer", label: "Hammer" },
  { key: "shopping", label: "Shopping" },
  { key: "map", label: "Map" },
  { key: "plane", label: "Plane" },
  { key: "file-text", label: "File" },
  { key: "link", label: "Link" },
  { key: "bell", label: "Bell" },
  { key: "zap", label: "Zap" },
  { key: "sparkles", label: "Sparkles" }
];

export function normalizeWorkspaceIconKey(value: unknown): WorkspaceIconKey {
  return WORKSPACE_ICON_OPTIONS.some((option) => option.key === value)
    ? (value as WorkspaceIconKey)
    : DEFAULT_WORKSPACE_ICON;
}

export function pickDefaultWorkspaceIcon(index: number): WorkspaceIconKey {
  return WORKSPACE_ICON_OPTIONS[index % WORKSPACE_ICON_OPTIONS.length]?.key ?? DEFAULT_WORKSPACE_ICON;
}
