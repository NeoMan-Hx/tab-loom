import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultState } from "../state/appState";
import { parseImportedState } from "./importExport";
import {
  DEFAULT_SYNC_CONFIG,
  createStateFingerprint,
  downloadStateFromSyncTarget,
  loadSyncConfig,
  markSyncConflict,
  readRemoteSyncSnapshot,
  saveSyncConfig,
  uploadStateToSyncTarget
} from "./sync";

const originalFetch = globalThis.fetch;
const originalLocalStorage = globalThis.localStorage;
const originalChrome = globalThis.chrome;

afterEach(() => {
  Object.defineProperty(globalThis, "fetch", { value: originalFetch, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: originalLocalStorage, configurable: true });
  Object.defineProperty(globalThis, "chrome", { value: originalChrome, configurable: true });
  vi.restoreAllMocks();
});

describe("sync", () => {
  it("saves and loads sync config separately from app state", async () => {
    Object.defineProperty(globalThis, "chrome", { value: undefined, configurable: true });
    Object.defineProperty(globalThis, "localStorage", { value: createMemoryStorage(), configurable: true });

    await saveSyncConfig({
      ...DEFAULT_SYNC_CONFIG,
      provider: "gist",
      autoSyncEnabled: true,
      autoSyncIntervalMinutes: 30,
      gist: {
        token: "token-value",
        gistId: "abc123",
        fileName: "loom.json"
      }
    });

    const loaded = await loadSyncConfig();

    expect(loaded.provider).toBe("gist");
    expect(loaded.autoSyncEnabled).toBe(true);
    expect(loaded.autoSyncIntervalMinutes).toBe(30);
    expect(loaded.gist.token).toBe("token-value");
    expect(loaded.gist.gistId).toBe("abc123");
    expect(localStorage.getItem("tabLoomState")).toBeNull();
  });

  it("uploads app state to a WebDAV file with PUT", async () => {
    Object.defineProperty(globalThis, "chrome", { value: undefined, configurable: true });
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    Object.defineProperty(globalThis, "fetch", { value: fetchMock, configurable: true });
    const state = createDefaultState();

    const result = await uploadStateToSyncTarget(
      {
        ...DEFAULT_SYNC_CONFIG,
        provider: "webdav",
        webdav: {
          url: "https://dav.example.com/tab-loom.json",
          username: "alice",
          password: "secret"
        }
      },
      state
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://dav.example.com/tab-loom.json");
    expect(init.method).toBe("PUT");
    expect((init.headers as Record<string, string>).Authorization).toMatch(/^Basic /);
    expect(parseImportedState(init.body as string).settings.activeWorkspaceId).toBe(state.settings.activeWorkspaceId);
    expect(result.config.lastSyncedStateFingerprint).toBe(createStateFingerprint(state));
    expect(result.config.lastRemoteStateFingerprint).toBe(createStateFingerprint(state));
  });

  it("creates a secret gist when uploading without a gist id", async () => {
    Object.defineProperty(globalThis, "chrome", { value: undefined, configurable: true });
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.method).toBe("POST");
      const body = JSON.parse(init.body as string);
      expect(body.public).toBe(false);
      expect(body.files["sync.json"].content).toContain("\"app\": \"tab-loom\"");
      return Response.json({ id: "new-gist-id", html_url: "https://gist.github.com/new-gist-id", files: {} });
    });
    Object.defineProperty(globalThis, "fetch", { value: fetchMock, configurable: true });

    const result = await uploadStateToSyncTarget(
      {
        ...DEFAULT_SYNC_CONFIG,
        provider: "gist",
        gist: {
          token: "gist-token",
          gistId: "",
          fileName: "sync.json"
        }
      },
      createDefaultState()
    );

    expect(fetchMock).toHaveBeenCalledWith("https://api.github.com/gists", expect.any(Object));
    expect(result.config.gist.gistId).toBe("new-gist-id");
  });

  it("downloads and parses a gist sync file", async () => {
    Object.defineProperty(globalThis, "chrome", { value: undefined, configurable: true });
    const state = createDefaultState();
    const content = JSON.stringify({ app: "tab-loom", exportedAt: "2026-06-09T00:00:00.000Z", state });
    const fetchMock = vi.fn(async () =>
      Response.json({
        id: "gist-id",
        html_url: "https://gist.github.com/gist-id",
        files: {
          "tab-loom-sync.json": {
            filename: "tab-loom-sync.json",
            content,
            truncated: false
          }
        }
      })
    );
    Object.defineProperty(globalThis, "fetch", { value: fetchMock, configurable: true });

    const result = await downloadStateFromSyncTarget({
      ...DEFAULT_SYNC_CONFIG,
      provider: "gist",
      gist: {
        token: "gist-token",
        gistId: "gist-id",
        fileName: "tab-loom-sync.json"
      }
    });

    expect(result.state.settings.activeWorkspaceId).toBe(state.settings.activeWorkspaceId);
    expect(result.config.lastSyncedStateFingerprint).toBe(createStateFingerprint(state));
  });

  it("reads a remote snapshot with exported timestamp and fingerprint", async () => {
    Object.defineProperty(globalThis, "chrome", { value: undefined, configurable: true });
    const state = createDefaultState();
    const content = JSON.stringify({ app: "tab-loom", exportedAt: "2026-06-09T00:00:00.000Z", state });
    const fetchMock = vi.fn(async () => new Response(content, { status: 200 }));
    Object.defineProperty(globalThis, "fetch", { value: fetchMock, configurable: true });

    const snapshot = await readRemoteSyncSnapshot({
      ...DEFAULT_SYNC_CONFIG,
      provider: "webdav",
      webdav: {
        url: "https://dav.example.com/tab-loom.json",
        username: "",
        password: ""
      }
    });

    expect(snapshot.exportedAt).toBe("2026-06-09T00:00:00.000Z");
    expect(snapshot.fingerprint).toBe(createStateFingerprint(state));
  });

  it("pauses auto sync when a conflict is marked", () => {
    const config = markSyncConflict(
      {
        ...DEFAULT_SYNC_CONFIG,
        autoSyncEnabled: true
      },
      "conflict"
    );

    expect(config.autoSyncEnabled).toBe(false);
    expect(config.lastSyncError).toBe("conflict");
  });
});

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value)
  };
}
