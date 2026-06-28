import { useDroppable } from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, Edit3, Folder as FolderIcon, GripVertical, MoreHorizontal, MoveRight, Play, Trash2 } from "lucide-react";
import type { Dispatch } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AppAction } from "../state/appState";
import { openSavedTabs } from "../services/chromeTabs";
import { getDomain } from "../services/sorting";
import type { EntityId, Folder, OpenFolderMode, OpenSavedTabMode, SavedTab, Workspace } from "../types";
import { SavedTabCard } from "./SavedTabCard";

type ActiveDragType = "open-tab" | "saved-tab" | "folder" | "workspace" | null;

interface FolderSectionProps {
  folder: Folder;
  tabs: SavedTab[];
  workspaces: Workspace[];
  openSavedTabMode: OpenSavedTabMode;
  openFolderMode: OpenFolderMode;
  editMode: boolean;
  activeDragType: ActiveDragType;
  dispatch: Dispatch<AppAction>;
}

export function FolderSection({
  folder,
  tabs,
  workspaces,
  openSavedTabMode,
  openFolderMode,
  editMode,
  activeDragType,
  dispatch
}: FolderSectionProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: `folder-sort:${folder.id}`,
    data: { type: "folder", folderId: folder.id, workspaceId: folder.workspaceId },
    disabled: !editMode
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  const targetWorkspaces = useMemo(
    () => workspaces.filter((workspace) => workspace.id !== folder.workspaceId),
    [folder.workspaceId, workspaces]
  );
  const showInsertTargets = !folder.collapsed && (activeDragType === "open-tab" || (editMode && activeDragType === "saved-tab"));

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setMoveMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setMoveMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const rename = () => {
    const name = prompt("文件夹名称", folder.name);
    if (name) dispatch({ type: "renameFolder", folderId: folder.id, name });
    setMenuOpen(false);
  };

  const moveToWorkspace = (targetWorkspaceId: string) => {
    dispatch({ type: "moveFolderToWorkspace", folderId: folder.id, targetWorkspaceId });
    setMoveMenuOpen(false);
    setMenuOpen(false);
  };

  const remove = () => {
    if (confirm(`删除文件夹“${folder.name}”？`)) {
      dispatch({ type: "deleteFolder", folderId: folder.id });
    }
    setMenuOpen(false);
  };

  return (
    <section
      ref={setNodeRef}
      className={[isOver ? "folder-section drop-target" : "folder-section", editMode ? "edit-mode" : "", isDragging ? "dragging" : ""]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      <header className="folder-header">
        {editMode && (
          <button className="drag-handle folder-drag-handle" type="button" title="拖拽排序文件夹" {...attributes} {...listeners}>
            <GripVertical size={16} />
          </button>
        )}

        <button className="icon-button subtle folder-toggle" type="button" title="折叠文件夹" onClick={() => dispatch({ type: "toggleFolder", folderId: folder.id })}>
          {folder.collapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
        </button>

        <div className={editMode ? "folder-title folder-drag-source" : "folder-title"} {...(editMode ? listeners : {})}>
          <FolderIcon className="folder-title-icon" size={22} />
          <h3>{folder.name}</h3>
          <span>{tabs.length} 个标签页</span>
        </div>

        <div className="folder-controls" ref={menuRef}>
          <button
            className="folder-open-button"
            type="button"
            title="打开全部"
            disabled={tabs.length === 0}
            onClick={() => void openSavedTabs(tabs, { mode: openFolderMode, groupTitle: folder.name })}
          >
            <Play size={15} />
            <span>打开全部</span>
          </button>
          <button className="icon-button subtle" type="button" title="文件夹操作" onClick={() => setMenuOpen((value) => !value)}>
            <MoreHorizontal size={18} />
          </button>

          {menuOpen && (
            <div className="folder-menu popover-panel">
              <button className="menu-action-button" type="button" onClick={rename}>
                <Edit3 size={15} />
                重命名
              </button>
              <button className="menu-action-button" type="button" disabled={targetWorkspaces.length === 0} onClick={() => setMoveMenuOpen((value) => !value)}>
                <MoveRight size={15} />
                移动到工作区
              </button>
              {moveMenuOpen && (
                <div className="folder-submenu popover-panel">
                  {targetWorkspaces.length === 0 ? (
                    <div className="menu-empty-note">没有其他工作区</div>
                  ) : (
                    targetWorkspaces.map((workspace) => (
                      <button key={workspace.id} className="menu-action-button" type="button" onClick={() => moveToWorkspace(workspace.id)}>
                        {workspace.name}
                      </button>
                    ))
                  )}
                </div>
              )}
              <button className="menu-action-button danger" type="button" onClick={remove}>
                <Trash2 size={15} />
                删除文件夹
              </button>
            </div>
          )}
        </div>
      </header>

      {!folder.collapsed && (
        <SortableContext items={tabs.map((tab) => `saved:${tab.id}`)} strategy={rectSortingStrategy}>
          <div className="saved-tab-grid">
            {tabs.length === 0 && !showInsertTargets && <div className="folder-empty passive">空文件夹</div>}
            {tabs.length === 0 && showInsertTargets && <EmptyFolderInsertDropZone folderId={folder.id} />}
            {tabs.map((tab, index) => (
              <SavedTabCard
                key={tab.id}
                tab={tab}
                domain={getDomain(tab.url)}
                openSavedTabMode={openSavedTabMode}
                editMode={editMode}
                showInsertTargets={showInsertTargets}
                insertIndex={index}
                isLast={index === tabs.length - 1}
                dispatch={dispatch}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </section>
  );
}

function EmptyFolderInsertDropZone({ folderId }: { folderId: EntityId }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `folder-insert:${folderId}:0`,
    data: { type: "folder-insert", folderId, index: 0 }
  });

  return (
    <div
      ref={setNodeRef}
      className={["folder-empty-insert-zone", isOver ? "over" : ""].filter(Boolean).join(" ")}
      aria-label="插入位置"
    />
  );
}
