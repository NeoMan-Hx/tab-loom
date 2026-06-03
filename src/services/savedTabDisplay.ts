import type { AppState, EntityId, SavedTab } from "../types";
import { getDomain } from "./sorting";

export interface SavedTabSearchResult {
  id: EntityId;
  tab: SavedTab;
  workspaceId: EntityId;
  workspaceName: string;
  folderId: EntityId;
  folderName: string;
  domain: string;
}

export function getSavedTabIconFallback(title: string, url: string): string {
  const text = title.trim() || getDomain(url) || url;
  const chinese = text.match(/[\u3400-\u9fff]/u)?.[0];
  if (chinese) return chinese;

  const ascii = text.match(/[a-z0-9]/giu)?.join("") ?? "";
  if (ascii) return ascii.slice(0, 2).toUpperCase();

  return "?";
}

export function searchSavedTabs(state: AppState, query: string, limit = 12): SavedTabSearchResult[] {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return [];

  const results: SavedTabSearchResult[] = [];
  const workspaces = Object.values(state.workspaces).sort((left, right) => left.manualOrder - right.manualOrder);

  for (const workspace of workspaces) {
    for (const folderId of workspace.folderIds) {
      const folder = state.folders[folderId];
      if (!folder) continue;

      for (const savedTabId of folder.savedTabIds) {
        const tab = state.savedTabs[savedTabId];
        if (!tab) continue;

        const domain = getDomain(tab.url);
        const haystack = `${tab.title} ${tab.url} ${domain} ${tab.tags.join(" ")}`.toLocaleLowerCase();
        if (!haystack.includes(term)) continue;

        results.push({
          id: tab.id,
          tab,
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          folderId: folder.id,
          folderName: folder.name,
          domain
        });

        if (results.length >= limit) return results;
      }
    }
  }

  return results;
}
