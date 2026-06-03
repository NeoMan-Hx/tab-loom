import { useEffect } from "react";
import type { ThemeMode } from "../types";

export function useThemeMode(themeMode: ThemeMode): void {
  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const resolvedTheme = themeMode === "system" ? (mediaQuery?.matches ? "dark" : "light") : themeMode;
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.dataset.themeMode = themeMode;
      document.documentElement.style.colorScheme = resolvedTheme === "light" ? "light" : "dark";
    };

    applyTheme();

    if (themeMode !== "system" || !mediaQuery) return undefined;

    mediaQuery.addEventListener?.("change", applyTheme);
    return () => mediaQuery.removeEventListener?.("change", applyTheme);
  }, [themeMode]);
}
