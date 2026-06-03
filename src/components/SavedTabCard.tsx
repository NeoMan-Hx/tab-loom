import { useDroppable } from "@dnd-kit/core";
import { defaultAnimateLayoutChanges, useSortable, type AnimateLayoutChanges } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Dispatch, KeyboardEvent as ReactKeyboardEvent, MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { AppAction } from "../state/appState";
import { openSavedTab } from "../services/chromeTabs";
import { getSavedTabIconFallback } from "../services/savedTabDisplay";
import type { OpenSavedTabMode, SavedTab } from "../types";

interface SavedTabCardProps {
  tab: SavedTab;
  domain: string;
  openSavedTabMode: OpenSavedTabMode;
  editMode: boolean;
  showInsertTargets?: boolean;
  insertIndex?: number;
  isLast?: boolean;
  dispatch: Dispatch<AppAction>;
}

export function SavedTabCard({
  tab,
  domain,
  openSavedTabMode,
  editMode,
  showInsertTargets = false,
  insertIndex = 0,
  isLast = false,
  dispatch
}: SavedTabCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(tab.title);
  const [url, setUrl] = useState(tab.url);
  const [favIconUrl, setFavIconUrl] = useState(tab.favIconUrl ?? "");
  const [error, setError] = useState("");
  const [iconFailed, setIconFailed] = useState(false);
  const [menuAlign, setMenuAlign] = useState<"left" | "right">("right");
  const menuRef = useRef<HTMLDivElement>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `saved:${tab.id}`,
    data: { type: "saved-tab", savedTabId: tab.id, folderId: tab.folderId },
    animateLayoutChanges: animateSavedTabLayoutChanges,
    disabled: { draggable: !editMode, droppable: false }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  useEffect(() => {
    setIconFailed(false);
  }, [tab.favIconUrl]);

  useEffect(() => {
    if (editing) return;
    setTitle(tab.title);
    setUrl(tab.url);
    setFavIconUrl(tab.favIconUrl ?? "");
  }, [editing, tab.favIconUrl, tab.title, tab.url]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setEditing(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setEditing(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const deleteTab = () => {
    if (confirm(`删除保存页“${tab.title}”？`)) {
      dispatch({ type: "deleteSavedTab", savedTabId: tab.id });
    }
    setMenuOpen(false);
  };

  const startEditing = () => {
    setTitle(tab.title);
    setUrl(tab.url);
    setFavIconUrl(tab.favIconUrl ?? "");
    setError("");
    setEditing(true);
  };

  const saveEdits = () => {
    const nextTitle = title.trim();
    const nextUrl = url.trim();
    const nextIcon = favIconUrl.trim();

    if (!nextTitle) {
      setError("标题不能为空。");
      return;
    }

    if (!isValidHttpUrl(nextUrl)) {
      setError("链接必须是有效的 http 或 https 地址。");
      return;
    }

    if (nextIcon && !isValidHttpUrl(nextIcon)) {
      setError("图标链接必须是有效的 http 或 https 地址，或留空清除。");
      return;
    }

    dispatch({
      type: "updateSavedTab",
      savedTabId: tab.id,
      patch: {
        title: nextTitle,
        url: nextUrl,
        favIconUrl: nextIcon || undefined
      }
    });
    setEditing(false);
    setMenuOpen(false);
  };

  const toggleMenu = () => {
    const nextOpen = !menuOpen;
    if (nextOpen && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      setMenuAlign(rect.right - 288 < 8 ? "left" : "right");
    } else {
      setEditing(false);
    }
    setMenuOpen(nextOpen);
  };

  const fallbackText = getSavedTabIconFallback(tab.title, tab.url);
  const showFallbackIcon = !tab.favIconUrl || iconFailed;
  const openTab = () => void openSavedTab(tab, openSavedTabMode);

  const handleCardClick = (event: MouseEvent<HTMLElement>) => {
    if (isCardOpenExcluded(event.target as HTMLElement)) return;
    openTab();
  };

  const handleCardKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (isCardOpenExcluded(event.target as HTMLElement)) return;
    event.preventDefault();
    openTab();
  };

  return (
    <article
      ref={setNodeRef}
      className={[isDragging ? "saved-tab-card dragging" : "saved-tab-card", editMode ? "edit-mode" : ""].filter(Boolean).join(" ")}
      style={style}
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      title={tab.title}
    >
      {showInsertTargets && (
        <>
          <SavedTabInsertDropZone folderId={tab.folderId} index={insertIndex} edge="before" />
          {isLast && <SavedTabInsertDropZone folderId={tab.folderId} index={insertIndex + 1} edge="after" />}
        </>
      )}

      <button className="drag-handle" type="button" title="拖拽排序" {...(editMode ? attributes : {})} {...(editMode ? listeners : {})}>
        <GripVertical size={16} />
      </button>

      <div className="favicon-mark" aria-hidden="true">
        {showFallbackIcon ? <span>{fallbackText}</span> : <img src={tab.favIconUrl} alt="" onError={() => setIconFailed(true)} />}
      </div>

      <div className="saved-tab-main">
        <span className="link-title" title={tab.title}>
          {tab.title}
        </span>
        <span className="domain-text">{domain}</span>
      </div>

      <div className="saved-tab-more" ref={menuRef} onClick={(event) => event.stopPropagation()}>
        <button className="icon-button subtle" type="button" title="更多操作" onClick={toggleMenu}>
          <MoreHorizontal size={16} />
        </button>

        {menuOpen && (
          <div className={`saved-tab-menu popover-panel align-${menuAlign} ${editing ? "editing" : ""}`}>
            {editing ? (
              <div className="edit-tab-form">
                <label>
                  标题
                  <input value={title} onChange={(event) => setTitle(event.target.value)} />
                </label>
                <label>
                  链接
                  <input value={url} onChange={(event) => setUrl(event.target.value)} />
                </label>
                <label>
                  图标链接
                  <input value={favIconUrl} placeholder="留空清除" onChange={(event) => setFavIconUrl(event.target.value)} />
                </label>
                {error && <p className="form-error">{error}</p>}
                <div className="menu-actions">
                  <button className="secondary-button compact" type="button" onClick={() => setEditing(false)}>
                    取消
                  </button>
                  <button className="primary-button compact" type="button" onClick={saveEdits}>
                    保存
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button className="menu-action-button" type="button" onClick={startEditing}>
                  <Pencil size={14} />
                  编辑
                </button>
                <button className="menu-action-button danger" type="button" onClick={deleteTab}>
                  <Trash2 size={14} />
                  删除
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function isCardOpenExcluded(target: HTMLElement): boolean {
  return Boolean(target.closest("button, input, textarea, select, a, .saved-tab-more, .saved-tab-insert-zone"));
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const animateSavedTabLayoutChanges: AnimateLayoutChanges = (args) => {
  return args.isSorting || args.wasDragging || defaultAnimateLayoutChanges(args);
};

function SavedTabInsertDropZone({ folderId, index, edge }: { folderId: string; index: number; edge: "before" | "after" }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `folder-insert:${folderId}:${index}`,
    data: { type: "folder-insert", folderId, index }
  });

  return (
    <div
      ref={setNodeRef}
      className={["saved-tab-insert-zone", edge, isOver ? "over" : ""].filter(Boolean).join(" ")}
      aria-label="插入位置"
    />
  );
}
