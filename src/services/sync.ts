import type { AppState } from "../types";
import { createExportText, parseImportedState } from "./importExport";
import { nowIso } from "./id";

const SYNC_CONFIG_KEY = "tabLoomSyncConfig";
export const SYNC_CONFIG_CHANGED_EVENT = "tabloom-sync-config-changed";
const DEFAULT_GIST_FILE_NAME = "tab-loom-sync.json";
const DEFAULT_AUTO_SYNC_INTERVAL_MINUTES = 15;

export type SyncProvider = "webdav" | "gist";

export interface WebDavSyncConfig {
  url: string;
  username: string;
  password: string;
}

export interface GistSyncConfig {
  token: string;
  gistId: string;
  fileName: string;
}

export interface SyncConfig {
  provider: SyncProvider;
  webdav: WebDavSyncConfig;
  gist: GistSyncConfig;
  autoSyncEnabled: boolean;
  autoSyncIntervalMinutes: number;
  lastSyncedAt?: string;
  lastSyncProvider?: SyncProvider;
  lastSyncedStateFingerprint?: string;
  lastRemoteStateFingerprint?: string;
  lastSyncMessage?: string;
  lastSyncError?: string;
}

export interface UploadSyncResult {
  config: SyncConfig;
  remoteLabel: string;
}

export interface DownloadSyncResult {
  config: SyncConfig;
  state: AppState;
  remoteLabel: string;
}

export interface RemoteSyncSnapshot {
  state: AppState;
  exportedAt?: string;
  fingerprint: string;
  remoteLabel: string;
}

interface GistFile {
  filename: string;
  content?: string;
  raw_url?: string;
  truncated?: boolean;
}

interface GistResponse {
  id: string;
  html_url?: string;
  files: Record<string, GistFile | undefined>;
}

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  provider: "webdav",
  webdav: {
    url: "",
    username: "",
    password: ""
  },
  gist: {
    token: "",
    gistId: "",
    fileName: DEFAULT_GIST_FILE_NAME
  },
  autoSyncEnabled: false,
  autoSyncIntervalMinutes: DEFAULT_AUTO_SYNC_INTERVAL_MINUTES
};

export async function loadSyncConfig(): Promise<SyncConfig> {
  const stored = await readStorageValue(SYNC_CONFIG_KEY);
  return normalizeSyncConfig(stored);
}

export async function saveSyncConfig(config: SyncConfig): Promise<void> {
  const normalized = normalizeSyncConfig(config);
  await writeStorageValue(SYNC_CONFIG_KEY, normalized);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SYNC_CONFIG_CHANGED_EVENT, { detail: normalized }));
  }
}

export async function uploadStateToSyncTarget(config: SyncConfig, state: AppState): Promise<UploadSyncResult> {
  const normalized = normalizeSyncConfig(config);
  const content = createExportText(state);
  const syncedAt = nowIso();
  const fingerprint = createStateFingerprint(state);

  if (normalized.provider === "webdav") {
    await uploadToWebDav(normalized.webdav, content);
    return {
      config: markSynced(normalized, "webdav", syncedAt, fingerprint, `已上传到 ${normalizeUrl(normalized.webdav.url)}。`),
      remoteLabel: normalizeUrl(normalized.webdav.url)
    };
  }

  const gist = await uploadToGist(normalized.gist, content);
  const nextConfig = markSynced(
    {
      ...normalized,
      gist: {
        ...normalized.gist,
        gistId: gist.id
      }
    },
    "gist",
    syncedAt,
    fingerprint,
    `已上传到 ${gist.html_url ?? `Gist ${gist.id}`}。`
  );

  return {
    config: nextConfig,
    remoteLabel: gist.html_url ?? `Gist ${gist.id}`
  };
}

export async function downloadStateFromSyncTarget(config: SyncConfig): Promise<DownloadSyncResult> {
  const normalized = normalizeSyncConfig(config);
  const syncedAt = nowIso();

  const result = await readRemoteSyncSnapshot(normalized);
  return {
    config: markSynced(normalized, normalized.provider, syncedAt, result.fingerprint, `已从 ${result.remoteLabel} 拉取。`),
    state: result.state,
    remoteLabel: result.remoteLabel
  };
}

export async function readRemoteSyncSnapshot(config: SyncConfig): Promise<RemoteSyncSnapshot> {
  const normalized = normalizeSyncConfig(config);
  if (normalized.provider === "webdav") {
    const content = await downloadFromWebDav(normalized.webdav);
    return parseRemoteSyncSnapshot(content, normalizeUrl(normalized.webdav.url));
  }

  const result = await downloadFromGist(normalized.gist);
  return parseRemoteSyncSnapshot(result.content, result.htmlUrl ?? `Gist ${normalized.gist.gistId}`);
}

export function normalizeSyncConfig(value: unknown): SyncConfig {
  const record = isRecord(value) ? value : {};
  const webdav = isRecord(record.webdav) ? record.webdav : {};
  const gist = isRecord(record.gist) ? record.gist : {};
  const provider = record.provider === "gist" ? "gist" : "webdav";

  return {
    provider,
    webdav: {
      url: typeof webdav.url === "string" ? webdav.url : "",
      username: typeof webdav.username === "string" ? webdav.username : "",
      password: typeof webdav.password === "string" ? webdav.password : ""
    },
    gist: {
      token: typeof gist.token === "string" ? gist.token : "",
      gistId: typeof gist.gistId === "string" ? gist.gistId : "",
      fileName: normalizeGistFileName(gist.fileName)
    },
    autoSyncEnabled: typeof record.autoSyncEnabled === "boolean" ? record.autoSyncEnabled : false,
    autoSyncIntervalMinutes: normalizeAutoSyncInterval(record.autoSyncIntervalMinutes),
    lastSyncedAt: typeof record.lastSyncedAt === "string" ? record.lastSyncedAt : undefined,
    lastSyncProvider: record.lastSyncProvider === "webdav" || record.lastSyncProvider === "gist" ? record.lastSyncProvider : undefined,
    lastSyncedStateFingerprint:
      typeof record.lastSyncedStateFingerprint === "string" ? record.lastSyncedStateFingerprint : undefined,
    lastRemoteStateFingerprint:
      typeof record.lastRemoteStateFingerprint === "string" ? record.lastRemoteStateFingerprint : undefined,
    lastSyncMessage: typeof record.lastSyncMessage === "string" ? record.lastSyncMessage : undefined,
    lastSyncError: typeof record.lastSyncError === "string" ? record.lastSyncError : undefined
  };
}

export function createStateFingerprint(state: AppState): string {
  return hashString(JSON.stringify(state));
}

export function markSyncError(config: SyncConfig, message: string): SyncConfig {
  return {
    ...normalizeSyncConfig(config),
    lastSyncError: message,
    lastSyncMessage: undefined
  };
}

export function markSyncConflict(config: SyncConfig, message: string): SyncConfig {
  return {
    ...normalizeSyncConfig(config),
    autoSyncEnabled: false,
    lastSyncError: message,
    lastSyncMessage: "自动同步已暂停：本地和远端都有新变化，需要手动上传或拉取。"
  };
}

export function markSynced(
  config: SyncConfig,
  provider: SyncProvider,
  syncedAt: string,
  fingerprint: string,
  message?: string
): SyncConfig {
  return {
    ...normalizeSyncConfig(config),
    lastSyncedAt: syncedAt,
    lastSyncProvider: provider,
    lastSyncedStateFingerprint: fingerprint,
    lastRemoteStateFingerprint: fingerprint,
    lastSyncMessage: message,
    lastSyncError: undefined
  };
}

function parseRemoteSyncSnapshot(text: string, remoteLabel: string): RemoteSyncSnapshot {
  const state = parseImportedState(text);
  const exportedAt = readExportedAt(text);
  return {
    state,
    exportedAt,
    fingerprint: createStateFingerprint(state),
    remoteLabel
  };
}

async function uploadToWebDav(config: WebDavSyncConfig, content: string): Promise<void> {
  const url = normalizeUrl(config.url);
  await ensureValidHttpUrl(url, "WebDAV 文件地址无效。");
  await ensureOptionalHostPermission(url);

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      ...createBasicAuthHeader(config.username, config.password),
      "Content-Type": "application/json;charset=utf-8"
    },
    body: content
  });

  await assertOk(response, "WebDAV 上传失败");
}

async function downloadFromWebDav(config: WebDavSyncConfig): Promise<string> {
  const url = normalizeUrl(config.url);
  await ensureValidHttpUrl(url, "WebDAV 文件地址无效。");
  await ensureOptionalHostPermission(url);

  const response = await fetch(url, {
    method: "GET",
    headers: createBasicAuthHeader(config.username, config.password)
  });

  await assertOk(response, "WebDAV 拉取失败");
  return response.text();
}

async function uploadToGist(config: GistSyncConfig, content: string): Promise<GistResponse> {
  const token = config.token.trim();
  const fileName = normalizeGistFileName(config.fileName);
  if (!token) throw new Error("请填写 GitHub token。");

  if (!config.gistId.trim()) {
    const response = await fetch("https://api.github.com/gists", {
      method: "POST",
      headers: createGistHeaders(token),
      body: JSON.stringify({
        description: "Tab Loom sync data",
        public: false,
        files: {
          [fileName]: { content }
        }
      })
    });

    await assertOk(response, "Gist 创建失败");
    return response.json();
  }

  const gistId = encodeURIComponent(config.gistId.trim());
  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: "PATCH",
    headers: createGistHeaders(token),
    body: JSON.stringify({
      files: {
        [fileName]: { content }
      }
    })
  });

  await assertOk(response, "Gist 上传失败");
  return response.json();
}

async function downloadFromGist(config: GistSyncConfig): Promise<{ content: string; htmlUrl?: string }> {
  const token = config.token.trim();
  const gistId = config.gistId.trim();
  const fileName = normalizeGistFileName(config.fileName);
  if (!token) throw new Error("请填写 GitHub token。");
  if (!gistId) throw new Error("请填写 Gist ID。首次使用请先上传以创建 Gist。");

  const response = await fetch(`https://api.github.com/gists/${encodeURIComponent(gistId)}`, {
    method: "GET",
    headers: createGistHeaders(token)
  });

  await assertOk(response, "Gist 拉取失败");
  const gist = (await response.json()) as GistResponse;
  const file = gist.files[fileName];
  if (!file) throw new Error(`Gist 中没有找到 ${fileName}。`);
  if (typeof file.content === "string" && !file.truncated) {
    return { content: file.content, htmlUrl: gist.html_url };
  }
  if (!file.raw_url) throw new Error(`Gist 文件 ${fileName} 内容不可用。`);

  const rawResponse = await fetch(file.raw_url);
  await assertOk(rawResponse, "Gist 原始文件拉取失败");
  return { content: await rawResponse.text(), htmlUrl: gist.html_url };
}

function createBasicAuthHeader(username: string, password: string): Record<string, string> {
  if (!username && !password) return {};
  return {
    Authorization: `Basic ${base64Encode(`${username}:${password}`)}`
  };
}

function createGistHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json;charset=utf-8",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

function base64Encode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

async function assertOk(response: Response, message: string): Promise<void> {
  if (response.ok) return;
  let detail = "";
  try {
    detail = await response.text();
  } catch {
    detail = "";
  }
  throw new Error(`${message}：HTTP ${response.status}${detail ? `，${detail.slice(0, 180)}` : ""}`);
}

async function ensureValidHttpUrl(value: string, message: string): Promise<void> {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(message);
  } catch {
    throw new Error(message);
  }
}

async function ensureOptionalHostPermission(value: string): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.permissions?.request) return;
  const url = new URL(value);
  const origin = `${url.protocol}//${url.host}/*`;
  const contains = chrome.permissions.contains
    ? await chrome.permissions.contains({ origins: [origin] })
    : false;
  if (contains) return;

  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) {
    throw new Error("未授权访问该 WebDAV 地址。");
  }
}

function normalizeGistFileName(value: unknown): string {
  const fileName = typeof value === "string" ? value.trim() : "";
  return fileName || DEFAULT_GIST_FILE_NAME;
}

function normalizeAutoSyncInterval(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_AUTO_SYNC_INTERVAL_MINUTES;
  return Math.max(5, Math.min(1440, Math.trunc(numeric)));
}

function normalizeUrl(value: string): string {
  return value.trim();
}

async function readStorageValue(key: string): Promise<unknown> {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    const result = await chrome.storage.local.get([key]);
    return result[key];
  }

  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : undefined;
}

async function writeStorageValue(key: string, value: unknown): Promise<void> {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }

  localStorage.setItem(key, JSON.stringify(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readExportedAt(text: string): string | undefined {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (isRecord(parsed) && typeof parsed.exportedAt === "string") {
      return parsed.exportedAt;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
