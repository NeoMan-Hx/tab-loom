import type { AppState, Folder, SavedTab, SortKey, SortView } from "../types";

export const DEFAULT_SORT_VIEWS: SortView[] = [
  { id: "sort_manual", name: "手动", key: "manual", direction: "asc" },
  { id: "sort_title", name: "标题", key: "title", direction: "asc" },
  { id: "sort_domain", name: "域名", key: "domain", direction: "asc" },
  { id: "sort_created_desc", name: "新建", key: "createdAt", direction: "desc" },
  { id: "sort_updated_desc", name: "更新", key: "updatedAt", direction: "desc" }
];

export function cloneDefaultSortViews(): SortView[] {
  return DEFAULT_SORT_VIEWS.map((view) => ({ ...view }));
}

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function getActiveSortView(folder: Folder): SortView {
  return folder.sortViews.find((view) => view.id === folder.activeSortViewId) ?? folder.sortViews[0] ?? DEFAULT_SORT_VIEWS[0];
}

export function sortSavedTabs(folder: Folder, state: AppState): SavedTab[] {
  const tabs = folder.savedTabIds
    .map((id) => state.savedTabs[id])
    .filter((tab): tab is SavedTab => Boolean(tab));

  const sortView = getActiveSortView(folder);
  const sorted = [...tabs];

  sorted.sort((left, right) => compareTabs(left, right, sortView.key));

  if (sortView.direction === "desc") {
    sorted.reverse();
  }

  return sorted;
}

function compareTabs(left: SavedTab, right: SavedTab, key: SortKey): number {
  if (key === "manual") {
    return left.manualOrder - right.manualOrder;
  }

  const leftValue = getComparableValue(left, key);
  const rightValue = getComparableValue(right, key);

  if (leftValue < rightValue) return -1;
  if (leftValue > rightValue) return 1;

  return left.manualOrder - right.manualOrder;
}

function getComparableValue(tab: SavedTab, key: SortKey): string | number {
  switch (key) {
    case "title":
      return tab.title.toLocaleLowerCase();
    case "domain":
      return getDomain(tab.url).toLocaleLowerCase();
    case "createdAt":
      return Date.parse(tab.createdAt) || 0;
    case "updatedAt":
      return Date.parse(tab.updatedAt) || 0;
    case "manual":
      return tab.manualOrder;
  }
}
