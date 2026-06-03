import type { AppState } from "../types";
import { createDefaultState } from "../state/appState";
import { assertAppState, migrateAppState } from "./importExport";

const STORAGE_KEY = "tabLoomState";
const MAX_HISTORY = 10;

export interface StoredAppData {
  state: AppState;
  history: AppState[];
}

export async function loadStoredState(): Promise<AppState> {
  return (await loadStoredData()).state;
}

export async function loadStoredData(): Promise<StoredAppData> {
  const stored = await readStorageValue();
  if (!stored) return { state: createDefaultState(), history: [] };

  try {
    const state = migrateAppState(isRecord(stored) && isRecord(stored.state) ? stored.state : stored);
    assertAppState(state);
    const history =
      isRecord(stored) && Array.isArray(stored.history)
        ? stored.history
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
            .slice(0, MAX_HISTORY)
        : [];
    return { state, history };
  } catch {
    return { state: createDefaultState(), history: [] };
  }
}

export async function saveStoredState(state: AppState): Promise<void> {
  await saveStoredData({ state, history: [] });
}

export async function saveStoredData(data: StoredAppData): Promise<void> {
  const record = {
    state: data.state,
    history: data.history.slice(0, MAX_HISTORY)
  };

  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    await chrome.storage.local.set({ [STORAGE_KEY]: record });
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
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
