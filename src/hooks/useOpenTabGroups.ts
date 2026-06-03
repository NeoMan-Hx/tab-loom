import { useCallback, useEffect, useState } from "react";
import { getOpenTabGroups } from "../services/chromeTabs";
import { subscribeToOpenTabChanges } from "../services/chromeTabEvents";
import type { OpenTabGroup } from "../types";

export function useOpenTabGroups(): {
  groups: OpenTabGroup[];
  loading: boolean;
} {
  const [groups, setGroups] = useState<OpenTabGroup[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setGroups(await getOpenTabGroups());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return subscribeToOpenTabChanges(() => void refresh());
  }, [refresh]);

  return { groups, loading };
}
