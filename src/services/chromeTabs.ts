import type { ChromeOpenTab, OpenFolderMode, OpenSavedTabMode, OpenTabGroup, SavedTab } from "../types";

const UNGROUPED_GROUP_ID = -1;

export interface CloseResult {
  closed: boolean;
  reason?: "pinned" | "missing-api" | "missing-tab-id" | "failed";
}

export function hasChromeTabApis(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.tabs?.query);
}

export async function getOpenTabGroups(): Promise<OpenTabGroup[]> {
  if (!hasChromeTabApis()) {
    return [];
  }

  const [tabs, groups] = await Promise.all([
    chrome.tabs.query({}),
    chrome.tabGroups?.query ? chrome.tabGroups.query({}) : Promise.resolve([])
  ]);

  const extensionRoot = chrome.runtime?.getURL?.("") ?? "";
  const openTabs = tabs
    .filter((tab) => isOpenTab(tab, extensionRoot))
    .map(toChromeOpenTab);

  return buildOpenTabGroups(openTabs, groups);
}

export function buildOpenTabGroups(
  tabs: ChromeOpenTab[],
  groups: Array<Pick<chrome.tabGroups.TabGroup, "id" | "title" | "color" | "windowId">>
): OpenTabGroup[] {
  const tabGroups = new Map<number, Pick<chrome.tabGroups.TabGroup, "id" | "title" | "color" | "windowId">>();
  groups.forEach((group) => tabGroups.set(group.id, group));

  const buckets = new Map<string, OpenTabGroup>();

  for (const tab of tabs) {
    const group = tab.groupId !== UNGROUPED_GROUP_ID ? tabGroups.get(tab.groupId) : undefined;
    const key = group ? `group:${group.id}` : "ungrouped";
    const bucket =
      buckets.get(key) ??
      (group
        ? {
            id: key,
            title: group.title?.trim() || "Tab Group",
            subtitle: `Window ${group.windowId}`,
            color: group.color,
            groupId: group.id,
            windowId: group.windowId,
            isUngrouped: false,
            tabs: []
          }
        : {
            id: key,
            title: "未分组",
            isUngrouped: true,
            tabs: []
          });

    bucket.tabs.push(tab);
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .map((group) => ({
      ...group,
      tabs: group.tabs.sort((left, right) => left.windowId - right.windowId || left.index - right.index)
    }))
    .sort((left, right) => {
      if (left.isUngrouped !== right.isUngrouped) return left.isUngrouped ? 1 : -1;
      const leftWindow = left.windowId ?? Number.MAX_SAFE_INTEGER;
      const rightWindow = right.windowId ?? Number.MAX_SAFE_INTEGER;
      return leftWindow - rightWindow || left.title.localeCompare(right.title);
    });
}

export async function closeOpenTab(tab: ChromeOpenTab): Promise<CloseResult> {
  if (tab.pinned) {
    return { closed: false, reason: "pinned" };
  }

  if (!hasChromeTabApis() || !chrome.tabs.remove) {
    return { closed: false, reason: "missing-api" };
  }

  if (!Number.isFinite(tab.id)) {
    return { closed: false, reason: "missing-tab-id" };
  }

  try {
    await chrome.tabs.remove(tab.id);
    return { closed: true };
  } catch {
    return { closed: false, reason: "failed" };
  }
}

export async function closeOriginalTabAfterSave(tab: ChromeOpenTab): Promise<CloseResult> {
  return closeOpenTab(tab);
}

export interface OpenSavedTabsOptions {
  mode: OpenFolderMode;
  groupTitle: string;
}

export async function openSavedTab(tab: Pick<SavedTab, "url">, mode: OpenSavedTabMode = "new-tab"): Promise<void> {
  if (typeof chrome !== "undefined" && chrome.tabs?.create) {
    if (mode === "current-tab" && chrome.tabs.update) {
      await chrome.tabs.update({ url: tab.url });
      return;
    }

    await chrome.tabs.create({ url: tab.url, active: true });
    return;
  }

  if (mode === "current-tab") {
    window.location.assign(tab.url);
    return;
  }

  window.open(tab.url, "_blank", "noopener,noreferrer");
}

export async function openSavedTabs(
  tabs: Array<Pick<SavedTab, "url">>,
  options: OpenSavedTabsOptions = { mode: "direct", groupTitle: "Tab Loom" }
): Promise<void> {
  if (typeof chrome !== "undefined" && chrome.tabs?.create) {
    const createdTabs = await Promise.all(tabs.map((tab, index) => chrome.tabs.create({ url: tab.url, active: index === 0 })));
    const createdTabIds = createdTabs
      .map((tab) => tab.id)
      .filter((id): id is number => typeof id === "number");

    if (options.mode === "chrome-group" && createdTabIds.length > 0 && chrome.tabs.group) {
      try {
        const groupTabs = chrome.tabs.group as unknown as (options: { tabIds: number[] }) => Promise<number>;
        const groupId = await groupTabs({ tabIds: createdTabIds });
        if (chrome.tabGroups?.update) {
          const updateGroup = chrome.tabGroups.update as unknown as (
            groupId: number,
            updateProperties: { title: string }
          ) => Promise<chrome.tabGroups.TabGroup>;
          await updateGroup(groupId, { title: options.groupTitle });
        }
      } catch {
        // Opening the tabs already succeeded; grouping is a best-effort enhancement.
      }
    }
    return;
  }

  tabs.forEach((tab) => window.open(tab.url, "_blank", "noopener,noreferrer"));
}

export function filterOpenTabGroups(groups: OpenTabGroup[], showPinned: boolean): OpenTabGroup[] {
  if (showPinned) return groups;
  return groups
    .map((group) => ({
      ...group,
      tabs: group.tabs.filter((tab) => !tab.pinned)
    }))
    .filter((group) => group.tabs.length > 0);
}

function isOpenTab(tab: chrome.tabs.Tab, extensionRoot: string): tab is chrome.tabs.Tab & { id: number; url: string } {
  if (typeof tab.id !== "number" || !tab.url) return false;
  if (extensionRoot && tab.url.startsWith(extensionRoot)) return false;
  if (tab.url.startsWith("chrome://newtab")) return false;
  return true;
}

function toChromeOpenTab(tab: chrome.tabs.Tab & { id: number; url: string }): ChromeOpenTab {
  return {
    id: tab.id,
    windowId: tab.windowId,
    groupId: tab.groupId ?? UNGROUPED_GROUP_ID,
    index: tab.index,
    title: tab.title || tab.url,
    url: tab.url,
    favIconUrl: tab.favIconUrl,
    pinned: Boolean(tab.pinned),
    active: Boolean(tab.active)
  };
}
