import { useLayoutEffect } from "react";
import { rememberThemeMode } from "../services/storage";
import type { ThemeMode } from "../types";

export function useThemeMode(themeMode: ThemeMode, enabled = true): void {
  useLayoutEffect(() => {
    if (!enabled) return undefined;

    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const resolvedTheme = themeMode === "system" ? (mediaQuery?.matches ? "dark" : "light") : themeMode;
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.dataset.themeMode = themeMode;
      document.documentElement.style.colorScheme = resolvedTheme === "light" ? "light" : "dark";
      document.documentElement.style.backgroundColor = "var(--bg)";
      rememberThemeMode(themeMode);
    };

    applyTheme();

    if (themeMode !== "system" || !mediaQuery) return undefined;

    mediaQuery.addEventListener?.("change", applyTheme);
    return () => mediaQuery.removeEventListener?.("change", applyTheme);
  }, [enabled, themeMode]);
}
