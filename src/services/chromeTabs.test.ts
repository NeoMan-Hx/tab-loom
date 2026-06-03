import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChromeOpenTab } from "../types";
import { buildOpenTabGroups, closeOriginalTabAfterSave, filterOpenTabGroups, getOpenTabGroups, openSavedTab, openSavedTabs } from "./chromeTabs";

const originalChrome = globalThis.chrome;

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(globalThis, "chrome", {
    value: originalChrome,
    configurable: true
  });
});

describe("chrome tab grouping", () => {
  it("does not merge same-title native tab groups from different windows", () => {
    const groups = buildOpenTabGroups(
      [
        makeOpenTab({ id: 1, groupId: 7, windowId: 1, title: "A" }),
        makeOpenTab({ id: 2, groupId: 8, windowId: 2, title: "B" })
      ],
      [
        { id: 7, title: "Research", color: "green", windowId: 1 },
        { id: 8, title: "Research", color: "green", windowId: 2 }
      ]
    );

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.groupId)).toEqual([7, 8]);
  });

  it("filters pinned open tabs when requested", () => {
    const groups = buildOpenTabGroups(
      [
        makeOpenTab({ id: 1, title: "Pinned", pinned: true }),
        makeOpenTab({ id: 2, title: "Regular", pinned: false })
      ],
      []
    );

    const filtered = filterOpenTabGroups(groups, false);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].tabs.map((tab) => tab.title)).toEqual(["Regular"]);
  });

  it("queries Chrome tabs and filters the current extension page", async () => {
    Object.defineProperty(globalThis, "chrome", {
      value: {
        runtime: { getURL: () => "chrome-extension://abc/" },
        tabs: {
          query: vi.fn().mockResolvedValue([
            { id: 1, windowId: 1, groupId: 7, index: 0, title: "Kept", url: "https://example.com", pinned: false, active: false },
            { id: 2, windowId: 1, groupId: -1, index: 1, title: "New Tab", url: "chrome-extension://abc/index.html", pinned: false, active: true }
          ])
        },
        tabGroups: {
          query: vi.fn().mockResolvedValue([{ id: 7, title: "Research", color: "cyan", windowId: 1 }])
        }
      },
      configurable: true
    });

    const groups = await getOpenTabGroups();

    expect(groups).toHaveLength(1);
    expect(groups[0].tabs).toHaveLength(1);
    expect(groups[0].tabs[0].title).toBe("Kept");
  });
});

describe("open saved tabs", () => {
  it("opens one saved tab in a new tab", async () => {
    const create = vi.fn().mockResolvedValue({ id: 1 });
    const update = vi.fn().mockResolvedValue({ id: 2 });
    Object.defineProperty(globalThis, "chrome", {
      value: { tabs: { query: vi.fn(), create, update } },
      configurable: true
    });

    await openSavedTab({ url: "https://example.com" }, "new-tab");

    expect(create).toHaveBeenCalledWith({ url: "https://example.com", active: true });
    expect(update).not.toHaveBeenCalled();
  });

  it("opens one saved tab in the current tab", async () => {
    const create = vi.fn().mockResolvedValue({ id: 1 });
    const update = vi.fn().mockResolvedValue({ id: 2 });
    Object.defineProperty(globalThis, "chrome", {
      value: { tabs: { query: vi.fn(), create, update } },
      configurable: true
    });

    await openSavedTab({ url: "https://example.com" }, "current-tab");

    expect(update).toHaveBeenCalledWith({ url: "https://example.com" });
    expect(create).not.toHaveBeenCalled();
  });

  it("groups folder tabs when Chrome grouping is enabled", async () => {
    const create = vi.fn()
      .mockResolvedValueOnce({ id: 11 })
      .mockResolvedValueOnce({ id: 12 });
    const group = vi.fn().mockResolvedValue(7);
    const update = vi.fn().mockResolvedValue({ id: 7 });
    Object.defineProperty(globalThis, "chrome", {
      value: {
        tabs: { query: vi.fn(), create, group },
        tabGroups: { update }
      },
      configurable: true
    });

    await openSavedTabs([{ url: "https://a.example" }, { url: "https://b.example" }], {
      mode: "chrome-group",
      groupTitle: "Research"
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(group).toHaveBeenCalledWith({ tabIds: [11, 12] });
    expect(update).toHaveBeenCalledWith(7, { title: "Research" });
  });
});

describe("closeOriginalTabAfterSave", () => {
  it("does not close pinned tabs", async () => {
    const remove = vi.fn();
    Object.defineProperty(globalThis, "chrome", {
      value: { tabs: { query: vi.fn(), remove } },
      configurable: true
    });

    const result = await closeOriginalTabAfterSave(makeOpenTab({ pinned: true }));

    expect(result).toEqual({ closed: false, reason: "pinned" });
    expect(remove).not.toHaveBeenCalled();
  });

  it("closes regular tabs", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, "chrome", {
      value: { tabs: { query: vi.fn(), remove } },
      configurable: true
    });

    const result = await closeOriginalTabAfterSave(makeOpenTab({ id: 31, pinned: false }));

    expect(result).toEqual({ closed: true });
    expect(remove).toHaveBeenCalledWith(31);
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
