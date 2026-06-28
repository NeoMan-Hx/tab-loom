import { afterEach, describe, expect, it } from "vitest";
import { appReducer, createDefaultState } from "../state/appState";
import { loadStoredData, saveStoredData } from "./storage";

const originalLocalStorage = globalThis.localStorage;
const originalChrome = globalThis.chrome;

afterEach(() => {
  Object.defineProperty(globalThis, "localStorage", { value: originalLocalStorage, configurable: true });
  Object.defineProperty(globalThis, "chrome", { value: originalChrome, configurable: true });
});

describe("storage history", () => {
  it("saves and loads at most ten history versions", async () => {
    Object.defineProperty(globalThis, "chrome", { value: undefined, configurable: true });
    Object.defineProperty(globalThis, "localStorage", { value: createMemoryStorage(), configurable: true });
    const state = createDefaultState();
    const history = Array.from({ length: 12 }, (_, index) =>
      appReducer(state, { type: "setThemeMode", themeMode: index % 2 === 0 ? "dark" : "light" })
    );

    await saveStoredData({ state, history, future: [] });
    const loaded = await loadStoredData();

    expect(loaded.state.settings.activeWorkspaceId).toBe(state.settings.activeWorkspaceId);
    expect(loaded.history).toHaveLength(10);
    expect(loaded.future).toEqual([]);
  });

  it("saves and loads at most ten redo versions", async () => {
    Object.defineProperty(globalThis, "chrome", { value: undefined, configurable: true });
    Object.defineProperty(globalThis, "localStorage", { value: createMemoryStorage(), configurable: true });
    const state = createDefaultState();
    const future = Array.from({ length: 12 }, (_, index) =>
      appReducer(state, { type: "setThemeMode", themeMode: index % 2 === 0 ? "dark" : "light" })
    );

    await saveStoredData({ state, history: [], future });
    const loaded = await loadStoredData();

    expect(loaded.future).toHaveLength(10);
  });

  it("loads legacy direct AppState values", async () => {
    Object.defineProperty(globalThis, "chrome", { value: undefined, configurable: true });
    const memoryStorage = createMemoryStorage();
    Object.defineProperty(globalThis, "localStorage", { value: memoryStorage, configurable: true });
    const state = createDefaultState();
    memoryStorage.setItem("tabLoomState", JSON.stringify(state));

    const loaded = await loadStoredData();

    expect(loaded.state.schemaVersion).toBe(state.schemaVersion);
    expect(loaded.history).toEqual([]);
    expect(loaded.future).toEqual([]);
  });

  it("mirrors the theme mode for first-paint initialization", async () => {
    Object.defineProperty(globalThis, "chrome", { value: undefined, configurable: true });
    const memoryStorage = createMemoryStorage();
    Object.defineProperty(globalThis, "localStorage", { value: memoryStorage, configurable: true });
    const state = appReducer(createDefaultState(), { type: "setThemeMode", themeMode: "dark" });

    await saveStoredData({ state, history: [], future: [] });

    expect(memoryStorage.getItem("tabLoomThemeMode")).toBe("dark");
  });
});

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value)
  };
}
