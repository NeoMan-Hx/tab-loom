import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Grip, Plus, Settings as SettingsIcon, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { FolderSection } from "./components/FolderSection";
import { GlobalSearch } from "./components/GlobalSearch";
import { OpenTabsPanel } from "./components/OpenTabsPanel";
import { SettingsPage } from "./components/SettingsPage";
import { WorkspaceNav } from "./components/WorkspaceNav";
import { useOpenTabGroups } from "./hooks/useOpenTabGroups";
import { usePersistentAppState } from "./hooks/usePersistentAppState";
import { useThemeMode } from "./hooks/useThemeMode";
import { useAutoSync } from "./hooks/useAutoSync";
import { closeOriginalTabAfterSave, filterOpenTabGroups } from "./services/chromeTabs";
import type { ChromeOpenTab, EntityId, SavedTab } from "./types";

type AppView = "workspace" | "settings";
type DragEntityType = "open-tab" | "saved-tab" | "folder" | "workspace" | null;

function App() {
  const { state, dispatch, status, canUndo, undo } = usePersistentAppState();
  const { groups: openGroups, loading: openTabsLoading } = useOpenTabGroups();
  const [dragOverlayText, setDragOverlayText] = useState<string | null>(null);
  const [activeDragType, setActiveDragType] = useState<DragEntityType>(null);
  const [view, setView] = useState<AppView>("workspace");
  const [editMode, setEditMode] = useState(false);
  useThemeMode(state.settings.themeMode);
  useAutoSync(state, dispatch, status);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const collisionDetection: CollisionDetection = (args) => {
    const activeType = args.active.data.current?.type;
    const droppableContainers = args.droppableContainers.filter((container) => isDroppableForActiveType(container.id, activeType));
    if (droppableContainers.length === 0) return [];

    const scopedArgs = { ...args, droppableContainers };

    if (activeType === "open-tab") {
      return pointerWithin(scopedArgs);
    }

    if (activeType === "saved-tab") {
      const exactCollisions = pointerWithin(scopedArgs);
      return exactCollisions.length > 0 ? exactCollisions : closestCenter(scopedArgs);
    }

    if (activeType === "folder") {
      const sectionCollisions = rectIntersection(scopedArgs);
      return sectionCollisions.length > 0 ? sectionCollisions : closestCenter(scopedArgs);
    }

    return closestCenter(scopedArgs);
  };

  const workspaces = useMemo(
    () => Object.values(state.workspaces).sort((left, right) => left.manualOrder - right.manualOrder),
    [state.workspaces]
  );

  const activeWorkspace = state.workspaces[state.settings.activeWorkspaceId] ?? workspaces[0];
  const activeFolders = useMemo(() => {
    if (!activeWorkspace) return [];
    return activeWorkspace.folderIds
      .map((folderId) => state.folders[folderId])
      .filter(Boolean)
      .sort((left, right) => left.manualOrder - right.manualOrder);
  }, [activeWorkspace, state.folders]);

  const filteredOpenGroups = useMemo(
    () => filterOpenTabGroups(openGroups, state.settings.showPinnedOpenTabs),
    [openGroups, state.settings.showPinnedOpenTabs]
  );
  const allVisibleOpenTabs = useMemo(() => filteredOpenGroups.flatMap((group) => group.tabs), [filteredOpenGroups]);

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    const dragType = (typeof data?.type === "string" ? data.type : null) as DragEntityType;

    if (dragType !== "open-tab" && !editMode) {
      setDragOverlayText(null);
      setActiveDragType(null);
      return;
    }

    setActiveDragType(dragType);

    if (dragType === "open-tab") {
      setDragOverlayText((data?.tab as ChromeOpenTab | undefined)?.title ?? null);
      return;
    }

    if (dragType === "saved-tab") {
      setDragOverlayText(state.savedTabs[data?.savedTabId as EntityId]?.title ?? null);
      return;
    }

    if (dragType === "folder") {
      setDragOverlayText(state.folders[data?.folderId as EntityId]?.name ?? null);
      return;
    }

    if (dragType === "workspace") {
      setDragOverlayText(state.workspaces[data?.workspaceId as EntityId]?.name ?? null);
      return;
    }

    setDragOverlayText(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const data = event.active.data.current;
    const over = event.over;
    setDragOverlayText(null);
    setActiveDragType(null);

    if (!over) return;

    if (data?.type === "workspace") {
      if (!editMode) return;
      const workspaceId = data.workspaceId as EntityId;
      const overWorkspaceId = getWorkspaceIdFromDropId(over.id);
      if (!workspaceId || !overWorkspaceId || workspaceId === overWorkspaceId) return;

      const oldIndex = workspaces.findIndex((workspace) => workspace.id === workspaceId);
      const newIndex = workspaces.findIndex((workspace) => workspace.id === overWorkspaceId);
      if (oldIndex < 0 || newIndex < 0) return;

      dispatch({
        type: "reorderWorkspaces",
        orderedWorkspaceIds: arrayMove(workspaces.map((workspace) => workspace.id), oldIndex, newIndex)
      });
      return;
    }

    if (data?.type === "folder") {
      if (!editMode) return;
      const folderId = data.folderId as EntityId;
      const workspaceId = data.workspaceId as EntityId;
      const overFolderId = getFolderSortIdFromDropId(over.id);
      const workspace = state.workspaces[workspaceId];
      if (!folderId || !overFolderId || folderId === overFolderId || !workspace) return;

      const oldIndex = workspace.folderIds.indexOf(folderId);
      const newIndex = workspace.folderIds.indexOf(overFolderId);
      if (oldIndex < 0 || newIndex < 0) return;

      dispatch({
        type: "reorderFolders",
        workspaceId,
        orderedFolderIds: arrayMove(workspace.folderIds, oldIndex, newIndex)
      });
      return;
    }

    if (data?.type === "open-tab") {
      const target = getOpenTabInsertTarget(over.id, state.folders);
      const tab = data.tab as ChromeOpenTab | undefined;
      if (!target || !tab) return;

      dispatch({ type: "saveOpenTab", folderId: target.folderId, tab, targetIndex: target.index });
      void closeOriginalTabAfterSave(tab);
      return;
    }

    if (data?.type === "saved-tab") {
      if (!editMode) return;
      const savedTabId = data.savedTabId as EntityId;
      const target = getSavedTabDropTarget(over.id, over.data.current, state.savedTabs, state.folders);
      if (!target || !state.savedTabs[savedTabId]) return;

      dispatch({
        type: "moveSavedTabToFolder",
        savedTabId,
        targetFolderId: target.folderId,
        targetIndex: target.index
      });
    }
  };

  const createFolder = () => {
    if (!activeWorkspace) return;
    const name = prompt("新文件夹名称");
    if (name) dispatch({ type: "createFolder", workspaceId: activeWorkspace.id, name });
  };

  const saveAllOpenTabs = () => {
    if (!activeWorkspace || allVisibleOpenTabs.length === 0) return;
    const defaultName = `已打开标签 ${formatLocalMinute(new Date())}`;
    const name = prompt("新文件夹名称", defaultName);
    if (!name) return;

    const shouldClose = confirm("保存后关闭所有非固定的原标签页？\n固定标签页会保留打开。");
    dispatch({ type: "createFolderFromOpenTabs", workspaceId: activeWorkspace.id, name, tabs: allVisibleOpenTabs });
    if (shouldClose) {
      void Promise.all(allVisibleOpenTabs.map((tab) => closeOriginalTabAfterSave(tab)));
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setDragOverlayText(null);
        setActiveDragType(null);
      }}
    >
      <div className={editMode ? "app-shell edit-mode" : "app-shell"}>
        <header className="topbar">
          {view === "workspace" ? (
            <WorkspaceNav
              workspaces={workspaces}
              activeWorkspaceId={activeWorkspace?.id}
              editMode={editMode}
              dispatch={dispatch}
            />
          ) : (
            <div className="topbar-title">设置</div>
          )}

          <div className="top-actions">
            {view === "workspace" && (
              <>
                <GlobalSearch state={state} />
                <button className="icon-button" type="button" title="撤销" onClick={undo} disabled={!canUndo}>
                  <Undo2 size={18} />
                </button>
                <button
                  className={editMode ? "icon-button active" : "icon-button"}
                  type="button"
                  title={editMode ? "退出编辑模式" : "编辑模式"}
                  onClick={() => setEditMode((value) => !value)}
                >
                  <Grip size={18} />
                </button>
                <button className="icon-button" type="button" title="设置" onClick={() => setView("settings")}>
                  <SettingsIcon size={18} />
                </button>
              </>
            )}
          </div>
        </header>

        {view === "settings" ? (
          <main className="settings-layout">
            <SettingsPage state={state} dispatch={dispatch} onBack={() => setView("workspace")} />
          </main>
        ) : (
          <main className="workspace-layout">
            <section className="folders-area" aria-label="Saved tab folders">
              <div className="workspace-heading">
                <div>
                  <h2>{activeWorkspace?.name ?? "工作台"}</h2>
                </div>
                <button className="primary-button" type="button" onClick={createFolder}>
                  <Plus size={17} />
                  文件夹
                </button>
              </div>

              <SortableContext items={activeFolders.map((folder) => `folder-sort:${folder.id}`)} strategy={verticalListSortingStrategy}>
                <div className="folder-stack">
                  {activeFolders.map((folder) => {
                    const sortedTabs = folder.savedTabIds
                      .map((savedTabId) => state.savedTabs[savedTabId])
                      .filter((savedTab): savedTab is SavedTab => Boolean(savedTab))
                      .sort((left, right) => left.manualOrder - right.manualOrder);
                    return (
                      <FolderSection
                        key={folder.id}
                        folder={folder}
                        tabs={sortedTabs}
                        workspaces={workspaces}
                        openSavedTabMode={state.settings.openSavedTabMode}
                        openFolderMode={state.settings.openFolderMode}
                        editMode={editMode}
                        activeDragType={activeDragType}
                        dispatch={dispatch}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </section>

            <OpenTabsPanel groups={filteredOpenGroups} loading={openTabsLoading} onSaveAll={saveAllOpenTabs} />
          </main>
        )}
      </div>

      <DragOverlay>{dragOverlayText ? <div className="drag-overlay">{dragOverlayText}</div> : null}</DragOverlay>
    </DndContext>
  );
}

function getWorkspaceIdFromDropId(id: unknown): EntityId | undefined {
  if (typeof id !== "string" || !id.startsWith("workspace:")) return undefined;
  return id.slice("workspace:".length);
}

function getFolderSortIdFromDropId(id: unknown): EntityId | undefined {
  if (typeof id !== "string" || !id.startsWith("folder-sort:")) return undefined;
  return id.slice("folder-sort:".length);
}

function getSavedTabIdFromDropId(id: unknown): EntityId | undefined {
  if (typeof id !== "string" || !id.startsWith("saved:")) return undefined;
  return id.slice("saved:".length);
}

function getOpenTabInsertTarget(
  overId: unknown,
  folders: Record<EntityId, { savedTabIds: EntityId[] }>
): { folderId: EntityId; index: number } | undefined {
  return getFolderInsertTargetFromDropId(overId, folders);
}

function getSavedTabDropTarget(
  overId: unknown,
  _overData: Record<string, unknown> | undefined,
  savedTabs: Record<EntityId, SavedTab>,
  folders: Record<EntityId, { savedTabIds: EntityId[] }>
): { folderId: EntityId; index: number } | undefined {
  const insertTarget = getFolderInsertTargetFromDropId(overId, folders);
  if (insertTarget) return insertTarget;

  const overSavedTabId = getSavedTabIdFromDropId(overId);
  const folderId = overSavedTabId ? savedTabs[overSavedTabId]?.folderId : undefined;
  if (!folderId) return undefined;

  const folder = folders[folderId];
  if (!folder) return undefined;

  if (!overSavedTabId) {
    return { folderId, index: folder.savedTabIds.length };
  }

  const index = folder.savedTabIds.indexOf(overSavedTabId);
  return { folderId, index: index >= 0 ? index : folder.savedTabIds.length };
}

function getFolderInsertTargetFromDropId(
  id: unknown,
  folders: Record<EntityId, { savedTabIds: EntityId[] }>
): { folderId: EntityId; index: number } | undefined {
  if (typeof id !== "string" || !id.startsWith("folder-insert:")) return undefined;

  const match = /^folder-insert:(.+):(\d+)$/.exec(id);
  if (!match) return undefined;

  const folderId = match[1];
  const folder = folders[folderId];
  const index = Number(match[2]);
  if (!folder || !Number.isFinite(index)) return undefined;

  return {
    folderId,
    index: Math.max(0, Math.min(Math.trunc(index), folder.savedTabIds.length))
  };
}

function isDroppableForActiveType(id: unknown, activeType: unknown): boolean {
  if (typeof id !== "string") return false;
  if (activeType === "open-tab") {
    return id.startsWith("folder-insert:");
  }
  if (activeType === "saved-tab") {
    return id.startsWith("saved:") || id.startsWith("folder-insert:");
  }
  if (activeType === "folder") return id.startsWith("folder-sort:");
  if (activeType === "workspace") return id.startsWith("workspace:");
  return true;
}

function formatLocalMinute(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default App;
