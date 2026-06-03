import { describe, expect, it } from "vitest";
import { appReducer, createDefaultState } from "../state/appState";
import type { ChromeOpenTab } from "../types";
import { getSavedTabIconFallback, searchSavedTabs } from "./savedTabDisplay";

describe("saved tab display helpers", () => {
  it("builds readable favicon fallback text", () => {
    expect(getSavedTabIconFallback("ChatGPT", "https://chatgpt.com")).toBe("CH");
    expect(getSavedTabIconFallback("我的文档", "https://example.com")).toBe("我");
    expect(getSavedTabIconFallback("", "https://example.com")).toBe("EX");
  });

  it("searches saved tabs across all workspaces", () => {
    let state = createDefaultState();
    const firstWorkspaceId = state.settings.activeWorkspaceId;
    const firstFolderId = state.workspaces[firstWorkspaceId].folderIds[0];
    state = appReducer(state, { type: "saveOpenTab", folderId: firstFolderId, tab: makeOpenTab({ title: "Alpha notes" }) });
    state = appReducer(state, { type: "createWorkspace", name: "Second" });
    const secondWorkspaceId = state.settings.activeWorkspaceId;
    const secondFolderId = state.workspaces[secondWorkspaceId].folderIds[0];
    state = appReducer(state, { type: "saveOpenTab", folderId: secondFolderId, tab: makeOpenTab({ title: "Beta report" }) });

    const results = searchSavedTabs(state, "beta");

    expect(results).toHaveLength(1);
    expect(results[0].workspaceName).toBe("Second");
    expect(results[0].folderName).toBe("收件箱");
    expect(results[0].tab.title).toBe("Beta report");
  });
});

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
