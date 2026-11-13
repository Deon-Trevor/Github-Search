/* ==========================================================================
   theme.js — the optional "Detective" night theme.
   The CSS does the visual work (see :root[data-theme="detective"] in
   styles.css). This module only decides which theme is active, applies it
   to <html data-theme>, and remembers the choice in localStorage.
   ========================================================================== */

// Must match the key in the inline <script> in index.html, which applies
// the saved theme before first paint.
export const THEME_STORAGE_KEY = "gh-explorer-theme";

export const THEMES = {
    classic: { label: "Classic", themeColor: "#f4f1e9" },
    detective: { label: "Detective", themeColor: "#0c0e11" },
};

/** Any unknown or missing value falls back to the classic theme. */
export function normalizeTheme(value) {
    return Object.hasOwn(THEMES, value) ? value : "classic";
}

/** The theme the toggle switches to from `current`. */
export function nextTheme(current) {
    return normalizeTheme(current) === "detective" ? "classic" : "detective";
}

/** Reads the saved theme. Storage can be blocked (private mode, sandboxed iframes), so failures mean "classic". */
export function loadTheme(storage = globalThis.localStorage) {
    try {
        return normalizeTheme(storage?.getItem(THEME_STORAGE_KEY));
    } catch {
        return "classic";
    }
}

/** Saves the choice; silently does nothing if storage is unavailable. */
export function saveTheme(theme, storage = globalThis.localStorage) {
    try {
        storage?.setItem(THEME_STORAGE_KEY, normalizeTheme(theme));
    } catch {
        /* storage blocked: the theme still applies for this visit */
    }
}

/**
 * Applies a theme to the page: <html data-theme>, the toggle's aria-pressed
 * and the browser theme-color. Elements are passed in so this module has no
 * DOM imports and stays testable in Node.
 */
export function applyTheme(theme, { toggle, themeColorMeta } = {}) {
    const name = normalizeTheme(theme);
    const root = document.documentElement;
    if (name === "classic") delete root.dataset.theme;
    else root.dataset.theme = name;
    toggle?.setAttribute("aria-pressed", String(name === "detective"));
    themeColorMeta?.setAttribute("content", THEMES[name].themeColor);
}
