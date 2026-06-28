import { horizontalListSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Edit3, GripVertical, Plus, Trash2 } from "lucide-react";
import type { Dispatch } from "react";
import { useEffect, useState } from "react";
import type { AppAction } from "../state/appState";
import { WORKSPACE_ICON_OPTIONS } from "../services/workspaceIcons";
import type { EntityId, Workspace, WorkspaceIconKey } from "../types";
import { WorkspaceIcon } from "./WorkspaceIcon";

interface WorkspaceNavProps {
  workspaces: Workspace[];
  activeWorkspaceId?: EntityId;
  editMode: boolean;
  dispatch: Dispatch<AppAction>;
}

export function WorkspaceNav({ workspaces, activeWorkspaceId, editMode, dispatch }: WorkspaceNavProps) {
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftName, setDraftName] = useState(activeWorkspace?.name ?? "");
  const [draftIcon, setDraftIcon] = useState<WorkspaceIconKey>(activeWorkspace?.iconKey ?? "briefcase");

  useEffect(() => {
    setDraftName(activeWorkspace?.name ?? "");
    setDraftIcon(activeWorkspace?.iconKey ?? "briefcase");
  }, [activeWorkspace?.id, activeWorkspace?.name, activeWorkspace?.iconKey]);

  useEffect(() => {
    if (!editMode) setEditorOpen(false);
  }, [editMode]);

  const createWorkspace = () => {
    const name = prompt("新工作区名称");
    if (name) dispatch({ type: "createWorkspace", name });
  };

  const saveWorkspace = () => {
    if (!activeWorkspace) return;
    if (draftName.trim()) {
      dispatch({ type: "renameWorkspace", workspaceId: activeWorkspace.id, name: draftName });
      dispatch({ type: "setWorkspaceIcon", workspaceId: activeWorkspace.id, iconKey: draftIcon });
      setEditorOpen(false);
    }
  };

  const deleteWorkspace = () => {
    if (!activeWorkspace || workspaces.length === 1) return;
    if (confirm(`删除工作区“${activeWorkspace.name}”？`)) {
      dispatch({ type: "deleteWorkspace", workspaceId: activeWorkspace.id });
      setEditorOpen(false);
    }
  };

  return (
    <nav className={editMode ? "workspace-nav edit-mode" : "workspace-nav"} aria-label="Workspaces">
      <div className="workspace-tabs">
        <SortableContext items={workspaces.map((workspace) => `workspace:${workspace.id}`)} strategy={horizontalListSortingStrategy}>
          {workspaces.map((workspace) => (
            <WorkspaceTab
              key={workspace.id}
              workspace={workspace}
              active={workspace.id === activeWorkspaceId}
              editMode={editMode}
              onSelect={() => dispatch({ type: "setActiveWorkspace", workspaceId: workspace.id })}
            />
          ))}
        </SortableContext>
      </div>

      {editMode && (
        <div className="workspace-tools">
          <button className="workspace-tool-button" type="button" title="新建工作区" onClick={createWorkspace}>
            <Plus size={19} />
          </button>
          <button className="workspace-tool-button" type="button" title="编辑工作区" onClick={() => setEditorOpen((value) => !value)}>
            <Edit3 size={17} />
          </button>
          <button className="workspace-tool-button danger" type="button" title="删除工作区" onClick={deleteWorkspace} disabled={workspaces.length === 1}>
            <Trash2 size={17} />
          </button>
        </div>
      )}

      {editMode && editorOpen && activeWorkspace && (
        <div className="workspace-editor popover-panel">
          <label>
            名称
            <input value={draftName} onChange={(event) => setDraftName(event.target.value)} />
          </label>
          <div className="workspace-icon-grid" aria-label="工作区图标">
            {WORKSPACE_ICON_OPTIONS.map((option) => (
              <button
                key={option.key}
                className={option.key === draftIcon ? "workspace-icon-option active" : "workspace-icon-option"}
                type="button"
                title={option.label}
                onClick={() => setDraftIcon(option.key)}
              >
                <WorkspaceIcon iconKey={option.key} />
              </button>
            ))}
          </div>
          <div className="menu-actions">
            <button className="secondary-button compact" type="button" onClick={() => setEditorOpen(false)}>
              取消
            </button>
            <button className="primary-button compact" type="button" onClick={saveWorkspace}>
              保存
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

function WorkspaceTab({
  workspace,
  active,
  editMode,
  onSelect
}: {
  workspace: Workspace;
  active: boolean;
  editMode: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `workspace:${workspace.id}`,
    data: { type: "workspace", workspaceId: workspace.id },
    disabled: !editMode
  });

  return (
    <button
      ref={setNodeRef}
      className={[active ? "workspace-tab active" : "workspace-tab", editMode ? "sortable" : "", isDragging ? "dragging" : ""]
        .filter(Boolean)
        .join(" ")}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      type="button"
      onClick={onSelect}
      title={workspace.name}
    >
      {editMode && (
        <span
          className="drag-handle workspace-drag-handle"
          title="拖拽排序工作区"
          onClick={(event) => event.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={15} />
        </span>
      )}
      <WorkspaceIcon iconKey={workspace.iconKey} />
      <span>{workspace.name}</span>
    </button>
  );
}
