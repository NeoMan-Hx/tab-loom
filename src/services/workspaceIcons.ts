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
  { key: "pin", label: "Pin" }
];

export function normalizeWorkspaceIconKey(value: unknown): WorkspaceIconKey {
  return WORKSPACE_ICON_OPTIONS.some((option) => option.key === value)
    ? (value as WorkspaceIconKey)
    : DEFAULT_WORKSPACE_ICON;
}

export function pickDefaultWorkspaceIcon(index: number): WorkspaceIconKey {
  return WORKSPACE_ICON_OPTIONS[index % WORKSPACE_ICON_OPTIONS.length]?.key ?? DEFAULT_WORKSPACE_ICON;
}
