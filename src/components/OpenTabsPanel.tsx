import { useDraggable } from "@dnd-kit/core";
import { ChevronDown, ChevronRight, FolderPlus, GripVertical, Pin } from "lucide-react";
import { useMemo, useState } from "react";
import { getDomain } from "../services/sorting";
import type { ChromeOpenTab, OpenTabGroup } from "../types";

interface OpenTabsPanelProps {
  groups: OpenTabGroup[];
  loading: boolean;
  onSaveAll: () => void;
}

export function OpenTabsPanel({ groups, loading, onSaveAll }: OpenTabsPanelProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const totalTabs = useMemo(() => groups.reduce((count, group) => count + group.tabs.length, 0), [groups]);

  const filteredGroups = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return groups;

    return groups
      .map((group) => ({
        ...group,
        tabs: group.tabs.filter((tab) => `${tab.title} ${tab.url}`.toLocaleLowerCase().includes(term))
      }))
      .filter((group) => group.tabs.length > 0);
  }, [groups, query]);

  const toggle = (groupId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  return (
    <aside className="open-tabs-panel" aria-label="Open browser tabs">
      <div className="open-tabs-toolbar">
        <input
          className="search-input"
          value={query}
          placeholder="搜索当前标签页"
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="icon-button subtle" type="button" title="保存全部为新文件夹" disabled={totalTabs === 0} onClick={onSaveAll}>
          <FolderPlus size={16} />
        </button>
      </div>

      <div className="open-group-list">
        {filteredGroups.length === 0 ? (
          <div className="open-tabs-empty">{loading ? "刷新中" : "暂无可保存标签页"}</div>
        ) : (
          filteredGroups.map((group) => {
            const isCollapsed = collapsed.has(group.id);
            return (
              <section key={group.id} className="open-group">
                <button className="open-group-header" type="button" onClick={() => toggle(group.id)}>
                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  <span className="group-color" style={{ backgroundColor: toGroupColor(group.color) }} />
                  <span>{group.title}</span>
                  {group.subtitle && <small>{group.subtitle}</small>}
                  <em>{group.tabs.length}</em>
                </button>

                {!isCollapsed && (
                  <div className="open-tab-rows">
                    {group.tabs.map((tab) => (
                      <OpenTabRow key={tab.id} tab={tab} />
                    ))}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </aside>
  );
}

function OpenTabRow({ tab }: { tab: ChromeOpenTab }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `open:${tab.id}`,
    data: { type: "open-tab", tab }
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`
      }
    : undefined;

  return (
    <div ref={setNodeRef} className={isDragging ? "open-tab-row dragging" : "open-tab-row"} style={style} {...attributes} {...listeners}>
      <GripVertical size={16} className="drag-grip" />
      <div className="open-tab-favicon">
        {tab.favIconUrl ? <img src={tab.favIconUrl} alt="" /> : <span>{getDomain(tab.url).slice(0, 1).toUpperCase()}</span>}
      </div>
      <div className="open-tab-copy">
        <span title={tab.title}>{tab.title}</span>
        <small>{getDomain(tab.url)}</small>
      </div>
      {tab.pinned && <Pin size={14} className="pin-icon" />}
    </div>
  );
}

function toGroupColor(color?: string): string {
  switch (color) {
    case "blue":
      return "#2563eb";
    case "red":
      return "#dc2626";
    case "yellow":
      return "#ca8a04";
    case "green":
      return "#16a34a";
    case "pink":
      return "#db2777";
    case "purple":
      return "#7c3aed";
    case "cyan":
      return "#0891b2";
    case "orange":
      return "#ea580c";
    default:
      return "#6b7280";
  }
}
