import { describe, expect, it } from "vitest";
import { appReducer, createDefaultState } from "./appState";
import type { ChromeOpenTab } from "../types";

describe("appReducer", () => {
  it("allows duplicate URLs in the same folder", () => {
    let state = createDefaultState();
    const folderId = firstFolderId(state);
    const tab = makeOpenTab({ title: "Example", url: "https://example.com/docs" });

    state = appReducer(state, { type: "saveOpenTab", folderId, tab });
    state = appReducer(state, { type: "saveOpenTab", folderId, tab });

    const folder = state.folders[folderId];
    expect(folder.savedTabIds).toHaveLength(2);
    expect(folder.savedTabIds.map((id) => state.savedTabs[id].url)).toEqual([
      "https://example.com/docs",
      "https://example.com/docs"
    ]);
  });

  it("reorders saved tabs and updates manual order", () => {
    let state = createDefaultState();
    const folderId = firstFolderId(state);

    state = appReducer(state, { type: "saveOpenTab", folderId, tab: makeOpenTab({ id: 1, title: "First" }) });
    state = appReducer(state, { type: "saveOpenTab", folderId, tab: makeOpenTab({ id: 2, title: "Second" }) });
    state = appReducer(state, { type: "saveOpenTab", folderId, tab: makeOpenTab({ id: 3, title: "Third" }) });

    const [firstId, secondId, thirdId] = state.folders[folderId].savedTabIds;
    state = appReducer(state, {
      type: "reorderSavedTabs",
      folderId,
      orderedSavedTabIds: [thirdId, firstId, secondId]
    });

    expect(state.folders[folderId].savedTabIds).toEqual([thirdId, firstId, secondId]);
    expect(state.savedTabs[thirdId].manualOrder).toBe(0);
    expect(state.savedTabs[firstId].manualOrder).toBe(1);
    expect(state.savedTabs[secondId].manualOrder).toBe(2);
  });

  it("saves an open tab at a requested index", () => {
    let state = createDefaultState();
    const folderId = firstFolderId(state);

    state = appReducer(state, { type: "saveOpenTab", folderId, tab: makeOpenTab({ id: 1, title: "First" }) });
    state = appReducer(state, { type: "saveOpenTab", folderId, tab: makeOpenTab({ id: 2, title: "Second" }) });
    state = appReducer(state, { type: "saveOpenTab", folderId, tab: makeOpenTab({ id: 3, title: "Inserted" }), targetIndex: 1 });

    const folder = state.folders[folderId];
    expect(folder.savedTabIds.map((id) => state.savedTabs[id].title)).toEqual(["First", "Inserted", "Second"]);
    expect(folder.savedTabIds.map((id) => state.savedTabs[id].manualOrder)).toEqual([0, 1, 2]);
  });

  it("moves saved tabs across folders and updates both folders", () => {
    let state = createDefaultState();
    const [sourceFolderId, targetFolderId] = firstWorkspaceFolderIds(state);

    state = appReducer(state, { type: "saveOpenTab", folderId: sourceFolderId, tab: makeOpenTab({ id: 1, title: "First" }) });
    state = appReducer(state, { type: "saveOpenTab", folderId: sourceFolderId, tab: makeOpenTab({ id: 2, title: "Second" }) });
    state = appReducer(state, { type: "saveOpenTab", folderId: targetFolderId, tab: makeOpenTab({ id: 3, title: "Target" }) });

    const movedTabId = state.folders[sourceFolderId].savedTabIds[0];
    state = appReducer(state, { type: "moveSavedTabToFolder", savedTabId: movedTabId, targetFolderId, targetIndex: 0 });

    expect(state.folders[sourceFolderId].savedTabIds).toHaveLength(1);
    expect(state.folders[targetFolderId].savedTabIds[0]).toBe(movedTabId);
    expect(state.savedTabs[movedTabId].folderId).toBe(targetFolderId);
    expect(state.savedTabs[movedTabId].manualOrder).toBe(0);
  });

  it("creates a folder from open tabs without deduplicating URLs", () => {
    let state = createDefaultState();
    const workspaceId = state.settings.activeWorkspaceId;

    state = appReducer(state, {
      type: "createFolderFromOpenTabs",
      workspaceId,
      name: "Opened",
      tabs: [
        makeOpenTab({ id: 1, title: "A", url: "https://example.com" }),
        makeOpenTab({ id: 2, title: "B", url: "https://example.com" })
      ]
    });

    const folderId = state.workspaces[workspaceId].folderIds.at(-1)!;
    const folder = state.folders[folderId];
    expect(folder.name).toBe("Opened");
    expect(folder.savedTabIds.map((id) => state.savedTabs[id].url)).toEqual(["https://example.com", "https://example.com"]);
  });

  it("moves folders to another workspace", () => {
    let state = createDefaultState();
    const sourceWorkspaceId = state.settings.activeWorkspaceId;
    const folderId = state.workspaces[sourceWorkspaceId].folderIds[0];

    state = appReducer(state, { type: "createWorkspace", name: "Target workspace" });
    const targetWorkspaceId = state.settings.activeWorkspaceId;
    state = appReducer(state, { type: "moveFolderToWorkspace", folderId, targetWorkspaceId });

    expect(state.workspaces[sourceWorkspaceId].folderIds).not.toContain(folderId);
    expect(state.workspaces[targetWorkspaceId].folderIds).toContain(folderId);
    expect(state.folders[folderId].workspaceId).toBe(targetWorkspaceId);
  });

  it("updates saved tab title, URL, and favicon URL", () => {
    let state = createDefaultState();
    const folderId = firstFolderId(state);

    state = appReducer(state, { type: "saveOpenTab", folderId, tab: makeOpenTab({ title: "Old title" }) });
    const savedTabId = state.folders[folderId].savedTabIds[0];

    state = appReducer(state, {
      type: "updateSavedTab",
      savedTabId,
      patch: {
        title: "New title",
        url: "https://example.com/new",
        favIconUrl: "https://example.com/icon.png"
      }
    });

    expect(state.savedTabs[savedTabId].title).toBe("New title");
    expect(state.savedTabs[savedTabId].url).toBe("https://example.com/new");
    expect(state.savedTabs[savedTabId].favIconUrl).toBe("https://example.com/icon.png");
  });

  it("reorders workspaces and updates manual order", () => {
    let state = createDefaultState();
    const firstWorkspaceId = state.settings.activeWorkspaceId;
    state = appReducer(state, { type: "createWorkspace", name: "Second" });
    const secondWorkspaceId = state.settings.activeWorkspaceId;

    state = appReducer(state, { type: "reorderWorkspaces", orderedWorkspaceIds: [secondWorkspaceId, firstWorkspaceId] });

    expect(state.workspaces[secondWorkspaceId].manualOrder).toBe(0);
    expect(state.workspaces[firstWorkspaceId].manualOrder).toBe(1);
  });

  it("reorders folders and updates workspace order", () => {
    let state = createDefaultState();
    const workspaceId = state.settings.activeWorkspaceId;
    const [firstFolderId, secondFolderId] = state.workspaces[workspaceId].folderIds;

    state = appReducer(state, { type: "reorderFolders", workspaceId, orderedFolderIds: [secondFolderId, firstFolderId] });

    expect(state.workspaces[workspaceId].folderIds).toEqual([secondFolderId, firstFolderId]);
    expect(state.folders[secondFolderId].manualOrder).toBe(0);
    expect(state.folders[firstFolderId].manualOrder).toBe(1);
  });

  it("sets the theme mode", () => {
    const state = appReducer(createDefaultState(), { type: "setThemeMode", themeMode: "black" });
    expect(state.settings.themeMode).toBe("black");
  });

  it("sets open behavior settings", () => {
    let state = createDefaultState();
    state = appReducer(state, { type: "setOpenSavedTabMode", mode: "current-tab" });
    state = appReducer(state, { type: "setShowPinnedOpenTabs", showPinned: false });
    state = appReducer(state, { type: "setOpenFolderMode", mode: "chrome-group" });
    state = appReducer(state, { type: "setSavedTabCardDisplayMode", mode: "title-only" });
    state = appReducer(state, { type: "setSavedTabTitleLineMode", mode: "double" });
    state = appReducer(state, { type: "setFontFamily", fontFamilyKey: "mono" });
    state = appReducer(state, { type: "setColorTheme", colorThemeKey: "one-dark" });
    state = appReducer(state, { type: "setCustomThemeEnabled", enabled: true });
    state = appReducer(state, { type: "setCustomThemeColor", colorKey: "topbar", color: "#123abc" });

    expect(state.settings.openSavedTabMode).toBe("current-tab");
    expect(state.settings.showPinnedOpenTabs).toBe(false);
    expect(state.settings.openFolderMode).toBe("chrome-group");
    expect(state.settings.savedTabCardDisplayMode).toBe("title-only");
    expect(state.settings.savedTabTitleLineMode).toBe("double");
    expect(state.settings.fontFamilyKey).toBe("mono");
    expect(state.settings.colorThemeKey).toBe("one-dark");
    expect(state.settings.customThemeEnabled).toBe(true);
    expect(state.settings.customThemeColors.topbar).toBe("#123abc");
  });

  it("ignores invalid custom theme colors and resets custom theme settings", () => {
    let state = createDefaultState();
    state = appReducer(state, { type: "setCustomThemeEnabled", enabled: true });
    state = appReducer(state, { type: "setCustomThemeColor", colorKey: "accent", color: "#0af" });
    state = appReducer(state, { type: "setCustomThemeColor", colorKey: "accentStrong", color: "not-a-color" });

    expect(state.settings.customThemeColors.accent).toBe("#00aaff");
    expect(state.settings.customThemeColors.accentStrong).toBeUndefined();

    state = appReducer(state, { type: "resetCustomThemeColors" });
    expect(state.settings.customThemeEnabled).toBe(false);
    expect(state.settings.customThemeColors).toEqual({});
  });
});

function firstFolderId(state: ReturnType<typeof createDefaultState>): string {
  return firstWorkspaceFolderIds(state)[0];
}

function firstWorkspaceFolderIds(state: ReturnType<typeof createDefaultState>): string[] {
  const workspace = state.workspaces[state.settings.activeWorkspaceId];
  return workspace.folderIds;
}

function makeOpenTab(overrides: Partial<ChromeOpenTab> = {}): ChromeOpenTab {
  return {
    id: 10,
    windowId: 1,
    groupId: -1,
    index: 0,
    title: "Example",
    url: "https://example.com",
    pinned: false,
    active: false,
    ...overrides
  };
}
