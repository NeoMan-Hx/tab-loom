import { describe, expect, it } from "vitest";
import { createDefaultState } from "../state/appState";
import { SCHEMA_VERSION } from "../types";
import { appendImportedText, createExportText, parseImportedState } from "./importExport";

describe("import/export", () => {
  it("round-trips exported state", () => {
    const state = createDefaultState();
    const imported = parseImportedState(createExportText(state));

    expect(imported.schemaVersion).toBe(SCHEMA_VERSION);
    expect(imported.settings.activeWorkspaceId).toBe(state.settings.activeWorkspaceId);
    expect(imported.settings.themeMode).toBe("system");
    expect(imported.settings.openSavedTabMode).toBe("new-tab");
    expect(imported.settings.showPinnedOpenTabs).toBe(true);
    expect(imported.settings.openFolderMode).toBe("direct");
  });

  it("migrates legacy workspaces with a default icon and light theme", () => {
    const state = createDefaultState();
    const workspaceId = state.settings.activeWorkspaceId;
    const folderId = state.workspaces[workspaceId].folderIds[0];
    const legacy = {
      ...state,
      schemaVersion: 1,
      settings: {
        activeWorkspaceId: workspaceId
      },
      workspaces: {
        [workspaceId]: {
          ...state.workspaces[workspaceId],
          iconKey: undefined
        }
      },
      folders: {
        ...state.folders,
        [folderId]: {
          ...state.folders[folderId],
          tags: ["legacy"]
        }
      }
    };

    const imported = parseImportedState(JSON.stringify(legacy));

    expect(imported.schemaVersion).toBe(SCHEMA_VERSION);
    expect(imported.workspaces[workspaceId].iconKey).toBe("briefcase");
    expect(imported.settings.themeMode).toBe("light");
    expect(Object.prototype.hasOwnProperty.call(imported.folders[folderId], "tags")).toBe(false);
  });

  it("migrates schema v3 settings to v4 defaults", () => {
    const state = createDefaultState();
    const legacy = {
      ...state,
      schemaVersion: 3,
      settings: {
        activeWorkspaceId: state.settings.activeWorkspaceId,
        themeMode: "dark"
      }
    };

    const imported = parseImportedState(JSON.stringify(legacy));

    expect(imported.schemaVersion).toBe(SCHEMA_VERSION);
    expect(imported.settings.themeMode).toBe("dark");
    expect(imported.settings.openSavedTabMode).toBe("new-tab");
    expect(imported.settings.showPinnedOpenTabs).toBe(true);
    expect(imported.settings.openFolderMode).toBe("direct");
  });

  it("appends native Tab Loom imports without replacing existing data", () => {
    const current = createDefaultState();
    const result = appendImportedText(current, createExportText(createDefaultState()));

    expect(result.summary.source).toBe("tab-loom");
    expect(result.summary.workspaces).toBe(1);
    expect(Object.keys(result.state.workspaces)).toHaveLength(2);
    expect(result.state.settings.activeWorkspaceId).toBe(current.settings.activeWorkspaceId);
  });

  it("imports tabtab backup data as appended workspaces, folders, and tabs", () => {
    const current = createDefaultState();
    const result = appendImportedText(current, JSON.stringify(makeTabtabBackup()));

    expect(result.summary).toEqual({
      source: "tabtab",
      workspaces: 3,
      folders: 13,
      tabs: 68,
      skippedTabs: 0
    });
    expect(Object.keys(result.state.workspaces)).toHaveLength(4);
    expect(Object.keys(result.state.folders)).toHaveLength(15);
    expect(Object.keys(result.state.savedTabs)).toHaveLength(68);
  });

  it("rejects unsupported schema versions", () => {
    const text = JSON.stringify({ schemaVersion: 999, workspaces: {}, folders: {}, savedTabs: {}, settings: {} });

    expect(() => parseImportedState(text)).toThrow(/不支持的数据版本/);
  });
});

function makeTabtabBackup() {
  const spaces = [
    { id: "space_home", name: "首页", groupCount: 6, tabCount: 31 },
    { id: "space_travel", name: "旅行", groupCount: 6, tabCount: 20 },
    { id: "space_snap", name: "Snap", groupCount: 1, tabCount: 17 }
  ];
  let tabIndex = 0;

  return {
    version: 1768758763109,
    space_list: spaces.map(({ id, name }) => ({ id, name })),
    spaces: Object.fromEntries(
      spaces.map((space) => {
        const groups = Array.from({ length: space.groupCount }, (_, groupIndex) => {
          const base = Math.floor(space.tabCount / space.groupCount);
          const extra = groupIndex < space.tabCount % space.groupCount ? 1 : 0;
          const tabs = Array.from({ length: base + extra }, () => {
            tabIndex += 1;
            return {
              kind: "record",
              id: `external_${tabIndex}`,
              title: `External ${tabIndex}`,
              url: `https://example.com/${tabIndex}`,
              favIconUrl: tabIndex <= 4 ? undefined : "https://example.com/favicon.ico",
              pinned: false
            };
          });

          return {
            id: `group_${space.id}_${groupIndex}`,
            name: `Group ${groupIndex + 1}`,
            tabs
          };
        });

        return [space.id, { id: space.id, name: space.name, groups, pins: {} }];
      })
    )
  };
}
