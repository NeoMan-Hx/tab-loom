import { describe, expect, it } from "vitest";
import { appReducer, createDefaultState } from "../state/appState";
import type { ChromeOpenTab } from "../types";
import { sortSavedTabs } from "./sorting";

describe("sortSavedTabs", () => {
  it("uses the selected sort view", () => {
    let state = createDefaultState();
    const folderId = firstFolderId(state);

    state = appReducer(state, {
      type: "saveOpenTab",
      folderId,
      tab: makeOpenTab({ id: 1, title: "Beta", url: "https://zeta.example/page" })
    });
    state = appReducer(state, {
      type: "saveOpenTab",
      folderId,
      tab: makeOpenTab({ id: 2, title: "Alpha", url: "https://alpha.example/page" })
    });

    state = appReducer(state, { type: "setFolderSort", folderId, sortViewId: "sort_title" });

    expect(sortSavedTabs(state.folders[folderId], state).map((tab) => tab.title)).toEqual(["Alpha", "Beta"]);
  });

  it("switches manual order when a tab is moved", () => {
    let state = createDefaultState();
    const folderId = firstFolderId(state);

    state = appReducer(state, { type: "saveOpenTab", folderId, tab: makeOpenTab({ id: 1, title: "First" }) });
    state = appReducer(state, { type: "saveOpenTab", folderId, tab: makeOpenTab({ id: 2, title: "Second" }) });

    const secondId = state.folders[folderId].savedTabIds[1];
    state = appReducer(state, { type: "moveSavedTab", folderId, savedTabId: secondId, direction: "up" });

    expect(sortSavedTabs(state.folders[folderId], state).map((tab) => tab.title)).toEqual(["Second", "First"]);
  });
});

function firstFolderId(state: ReturnType<typeof createDefaultState>): string {
  const workspace = state.workspaces[state.settings.activeWorkspaceId];
  return workspace.folderIds[0];
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
