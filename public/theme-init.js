(function () {
  var THEME_KEY = "tabLoomThemeMode";
  var STATE_KEY = "tabLoomState";
  var THEMES = ["light", "dark", "black", "system"];
  var COLOR_THEMES = ["vscode", "darcula", "one-dark", "github", "solarized", "nord"];
  var CUSTOM_THEME_VARIABLES = {
    background: ["--bg"],
    backgroundGlow: ["--bg-glow"],
    surface: ["--surface"],
    surfaceSoft: ["--surface-soft"],
    surfaceHover: ["--surface-hover"],
    surfaceSelected: ["--surface-selected"],
    line: ["--line"],
    lineSoft: ["--line-soft"],
    text: ["--text"],
    textSoft: ["--text-soft", "--muted-strong"],
    muted: ["--muted"],
    accent: ["--accent"],
    accentStrong: ["--accent-strong"],
    accentSoft: ["--accent-soft"],
    accentText: ["--accent-text"],
    topbar: ["--custom-topbar-bg"],
    rightSidebar: ["--custom-open-tabs-bg"],
    rightSearch: ["--custom-open-tabs-search-bg"],
    savedCard: ["--custom-saved-card-bg"],
    popover: ["--custom-popover-bg"]
  };
  var CUSTOM_THEME_VARIABLE_NAMES = Object.keys(CUSTOM_THEME_VARIABLES).reduce(function (names, key) {
    CUSTOM_THEME_VARIABLES[key].forEach(function (name) {
      if (names.indexOf(name) < 0) names.push(name);
    });
    return names;
  }, []);
  var COLORS = {
    vscode: { light: "#f6f8fa", dark: "#1e1e1e", black: "#000000" },
    darcula: { light: "#f8f9f7", dark: "#2b2b2b", black: "#000000" },
    "one-dark": { light: "#f6f8fa", dark: "#282c34", black: "#000000" },
    github: { light: "#f6f8fa", dark: "#0d1117", black: "#000000" },
    solarized: { light: "#fdf6e3", dark: "#002b36", black: "#000000" },
    nord: { light: "#eceff4", dark: "#2e3440", black: "#000000" }
  };

  function isThemeMode(value) {
    return THEMES.indexOf(value) >= 0;
  }

  function isColorTheme(value) {
    return COLOR_THEMES.indexOf(value) >= 0;
  }

  function resolveTheme(mode) {
    if (mode === "black") return "black";
    if (mode === "dark") return "dark";
    if (mode === "system") {
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  }

  function applyTheme(mode, colorTheme) {
    var themeMode = isThemeMode(mode) ? mode : "system";
    var resolvedTheme = resolveTheme(themeMode);
    var resolvedColorTheme = isColorTheme(colorTheme) ? colorTheme : "vscode";
    var root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.dataset.themeMode = themeMode;
    root.dataset.colorTheme = resolvedColorTheme;
    root.style.colorScheme = resolvedTheme === "light" ? "light" : "dark";
    root.style.backgroundColor = (COLORS[resolvedColorTheme] && COLORS[resolvedColorTheme][resolvedTheme]) || COLORS.vscode.light;
  }

  function isHexColor(value) {
    return typeof value === "string" && (/^#[0-9a-fA-F]{3}$/.test(value) || /^#[0-9a-fA-F]{6}$/.test(value));
  }

  function applyCustomTheme(settings) {
    var root = document.documentElement;
    CUSTOM_THEME_VARIABLE_NAMES.forEach(function (name) {
      root.style.removeProperty(name);
    });

    if (!settings || settings.customThemeEnabled !== true || !settings.customThemeColors) {
      root.dataset.customTheme = "false";
      return;
    }

    root.dataset.customTheme = "true";
    Object.keys(settings.customThemeColors).forEach(function (key) {
      var variableNames = CUSTOM_THEME_VARIABLES[key];
      var color = settings.customThemeColors[key];
      if (!variableNames || !isHexColor(color)) return;
      variableNames.forEach(function (name) {
        root.style.setProperty(name, color);
      });
    });

    if (isHexColor(settings.customThemeColors.accent) && !isHexColor(settings.customThemeColors.accentStrong)) {
      root.style.setProperty("--accent-strong", settings.customThemeColors.accent);
    }

    if (isHexColor(settings.customThemeColors.background)) {
      root.style.backgroundColor = settings.customThemeColors.background;
    }
  }

  function rememberThemeMode(mode) {
    if (!isThemeMode(mode)) return;
    try {
      window.localStorage.setItem(THEME_KEY, mode);
    } catch (_) {
      // Ignore storage failures; the theme is still applied for this page.
    }
  }

  function readStoredSettings(record) {
    if (!record || typeof record !== "object") return undefined;
    var state = record.state && typeof record.state === "object" ? record.state : record;
    return state.settings && typeof state.settings === "object" ? state.settings : undefined;
  }

  function readStoredThemeMode(record) {
    var settings = readStoredSettings(record);
    return settings && isThemeMode(settings.themeMode) ? settings.themeMode : undefined;
  }

  function readStoredColorTheme(record) {
    var settings = readStoredSettings(record);
    return settings && isColorTheme(settings.colorThemeKey) ? settings.colorThemeKey : undefined;
  }

  var initialMode = "system";
  try {
    var localMode = window.localStorage.getItem(THEME_KEY);
    if (isThemeMode(localMode)) initialMode = localMode;
  } catch (_) {
    // Fall back to system preference.
  }

  applyTheme(initialMode, "vscode");
  applyCustomTheme(undefined);

  try {
    if (window.chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([STATE_KEY], function (result) {
        var record = result && result[STATE_KEY];
        var settings = readStoredSettings(record);
        var mode = readStoredThemeMode(record);
        var colorTheme = readStoredColorTheme(record);
        if (!mode && !colorTheme && !settings) return;
        if (mode) rememberThemeMode(mode);
        applyTheme(mode || initialMode, colorTheme || "vscode");
        applyCustomTheme(settings);
      });
    }
  } catch (_) {
    // The app will apply the stored theme once React and storage are ready.
  }
})();
