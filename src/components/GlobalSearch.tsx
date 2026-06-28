import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { openSavedTab } from "../services/chromeTabs";
import { searchSavedTabs } from "../services/savedTabDisplay";
import type { AppState } from "../types";

interface GlobalSearchProps {
  state: AppState;
}

export function GlobalSearch({ state }: GlobalSearchProps) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const results = useMemo(() => searchSavedTabs(state, query), [query, state]);
  const showResults = query.trim().length > 0;

  useEffect(() => {
    if (!expanded) return undefined;
    inputRef.current?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setExpanded(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [expanded]);

  const openSearch = () => {
    setExpanded(true);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <div className={expanded ? "global-search expanded" : "global-search"} ref={rootRef}>
      <div className="global-search-control">
        <button
          className="global-search-trigger"
          type="button"
          title="搜索全部保存标签页"
          aria-expanded={expanded}
          onClick={openSearch}
        >
          <Search size={22} />
        </button>
        <input
          ref={inputRef}
          className="global-search-inline-input"
          value={query}
          placeholder="搜索全部保存标签页"
          tabIndex={expanded ? 0 : -1}
          onFocus={() => setExpanded(true)}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {expanded && showResults && (
        <div className="global-search-box popover-panel">
          <div className="global-search-results">
            {results.length === 0 ? (
              <div className="search-empty">没有匹配的标签页</div>
            ) : (
              results.map((result) => (
                <button
                  key={result.id}
                  className="search-result"
                  type="button"
                  onClick={() => {
                    setExpanded(false);
                    setQuery("");
                    void openSavedTab(result.tab, state.settings.openSavedTabMode);
                  }}
                >
                  <span className="search-result-title">{result.tab.title}</span>
                  <span className="search-result-meta">
                    {result.workspaceName} / {result.folderName} / {result.domain}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
