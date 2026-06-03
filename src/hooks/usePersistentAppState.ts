import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { Dispatch } from "react";
import type { AppAction } from "../state/appState";
import { appReducer, createDefaultState } from "../state/appState";
import type { AppState } from "../types";
import { loadStoredData, saveStoredData } from "../services/storage";

export type StorageStatus = "loading" | "ready" | "error";

const MAX_HISTORY = 10;

interface StoreState {
  state: AppState;
  history: AppState[];
}

type StoreAction =
  | { type: "load"; state: AppState; history: AppState[] }
  | { type: "app"; action: AppAction }
  | { type: "undo" };

export function usePersistentAppState(): {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  status: StorageStatus;
  canUndo: boolean;
  undo: () => void;
} {
  const [store, dispatchStore] = useReducer(storeReducer, undefined, () => ({
    state: createDefaultState(),
    history: []
  }));
  const [status, setStatus] = useState<StorageStatus>("loading");
  const hasLoaded = useRef(false);

  useEffect(() => {
    let cancelled = false;

    loadStoredData()
      .then((storedData) => {
        if (cancelled) return;
        dispatchStore({ type: "load", state: storedData.state, history: storedData.history });
        hasLoaded.current = true;
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        hasLoaded.current = true;
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoaded.current) return;
    void saveStoredData(store).catch(() => setStatus("error"));
  }, [store]);

  const stableDispatch = useCallback<Dispatch<AppAction>>((action) => {
    dispatchStore({ type: "app", action });
  }, []);

  const undo = useCallback(() => {
    dispatchStore({ type: "undo" });
  }, []);

  return { state: store.state, dispatch: stableDispatch, status, canUndo: store.history.length > 0, undo };
}

function storeReducer(store: StoreState, action: StoreAction): StoreState {
  switch (action.type) {
    case "load":
      return {
        state: action.state,
        history: action.history.slice(0, MAX_HISTORY)
      };

    case "undo": {
      const [previous, ...rest] = store.history;
      return previous ? { state: previous, history: rest } : store;
    }

    case "app": {
      const nextState = appReducer(store.state, action.action);
      if (nextState === store.state) return store;

      return {
        state: nextState,
        history: isUndoableAction(action.action) ? [store.state, ...store.history].slice(0, MAX_HISTORY) : store.history
      };
    }
  }
}

function isUndoableAction(action: AppAction): boolean {
  return (
    action.type === "deleteWorkspace" ||
    action.type === "deleteFolder" ||
    action.type === "deleteSavedTab" ||
    action.type === "moveSavedTab" ||
    action.type === "reorderSavedTabs" ||
    action.type === "moveSavedTabToFolder" ||
    action.type === "moveFolderToWorkspace" ||
    action.type === "reorderFolders" ||
    action.type === "reorderWorkspaces"
  );
}
