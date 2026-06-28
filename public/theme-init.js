(function () {
  var THEME_KEY = "tabLoomThemeMode";
  var STATE_KEY = "tabLoomState";
  var THEMES = ["light", "dark", "black", "system"];
  var COLORS = {
    light: "#f8f9f7",
    dark: "#0d0f12",
    black: "#000000"
  };

  function isThemeMode(value) {
    return THEMES.indexOf(value) >= 0;
  }

  function resolveTheme(mode) {
    if (mode === "black") return "black";
    if (mode === "dark") return "dark";
    if (mode === "system") {
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  }

  function applyTheme(mode) {
    var themeMode = isThemeMode(mode) ? mode : "system";
    var resolvedTheme = resolveTheme(themeMode);
    var root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.dataset.themeMode = themeMode;
    root.style.colorScheme = resolvedTheme === "light" ? "light" : "dark";
    root.style.backgroundColor = COLORS[resolvedTheme] || COLORS.light;
  }

  function rememberThemeMode(mode) {
    if (!isThemeMode(mode)) return;
    try {
      window.localStorage.setItem(THEME_KEY, mode);
    } catch (_) {
      // Ignore storage failures; the theme is still applied for this page.
    }
  }

  function readStoredThemeMode(record) {
    if (!record || typeof record !== "object") return undefined;
    var state = record.state && typeof record.state === "object" ? record.state : record;
    var settings = state.settings && typeof state.settings === "object" ? state.settings : undefined;
    return settings && isThemeMode(settings.themeMode) ? settings.themeMode : undefined;
  }

  var initialMode = "system";
  try {
    var localMode = window.localStorage.getItem(THEME_KEY);
    if (isThemeMode(localMode)) initialMode = localMode;
  } catch (_) {
    // Fall back to system preference.
  }

  applyTheme(initialMode);

  try {
    if (window.chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([STATE_KEY], function (result) {
        var mode = readStoredThemeMode(result && result[STATE_KEY]);
        if (!mode) return;
        rememberThemeMode(mode);
        applyTheme(mode);
      });
    }
  } catch (_) {
    // The app will apply the stored theme once React and storage are ready.
  }
})();
