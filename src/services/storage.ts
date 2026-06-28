import type { AppState } from "../types";
import { createDefaultState } from "../state/appState";
import { assertAppState, migrateAppState } from "./importExport";

const STORAGE_KEY = "tabLoomState";
const THEME_MODE_STORAGE_KEY = "tabLoomThemeMode";
const MAX_HISTORY = 10;

export interface StoredAppData {
  state: AppState;
  history: AppState[];
  future: AppState[];
}

export async function loadStoredState(): Promise<AppState> {
  return (await loadStoredData()).state;
}

export async function loadStoredData(): Promise<StoredAppData> {
  const stored = await readStorageValue();
  if (!stored) {
    const state = createDefaultState();
    rememberThemeMode(state.settings.themeMode);
    return { state, history: [], future: [] };
  }

  try {
    const state = migrateAppState(isRecord(stored) && isRecord(stored.state) ? stored.state : stored);
    assertAppState(state);
    rememberThemeMode(state.settings.themeMode);
    const history = readStateStack(isRecord(stored) ? stored.history : undefined);
    const future = readStateStack(isRecord(stored) ? stored.future : undefined);
    return { state, history, future };
  } catch {
    return { state: createDefaultState(), history: [], future: [] };
  }
}

export async function saveStoredState(state: AppState): Promise<void> {
  await saveStoredData({ state, history: [], future: [] });
}

export async function saveStoredData(data: StoredAppData): Promise<void> {
  const record = {
    state: data.state,
    history: data.history.slice(0, MAX_HISTORY),
    future: data.future.slice(0, MAX_HISTORY)
  };
  rememberThemeMode(record.state.settings.themeMode);

  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    await chrome.storage.local.set({ [STORAGE_KEY]: record });
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

function readStateStack(value: unknown): AppState[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      try {
        const migrated = migrateAppState(entry);
        assertAppState(migrated);
        return migrated;
      } catch {
        return undefined;
      }
    })
    .filter((entry): entry is AppState => Boolean(entry))
    .slice(0, MAX_HISTORY);
}

export function rememberThemeMode(themeMode: AppState["settings"]["themeMode"]): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(THEME_MODE_STORAGE_KEY, themeMode);
  } catch {
    // Theme mirroring is only an anti-flash optimization.
  }
}

async function readStorageValue(): Promise<unknown> {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    return result[STORAGE_KEY];
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
