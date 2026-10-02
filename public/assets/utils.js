/* ==========================================================================
   utils.js — small standalone helpers with no DOM-cache, state, or API
   dependencies.
   ========================================================================== */

export const copy = (text) =>
    navigator.clipboard.writeText(text).catch(() => console.warn("Clipboard error"));

export function setURL(key, value) {
    const url = new URL(location);
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
    history.replaceState({}, "", url);
}
