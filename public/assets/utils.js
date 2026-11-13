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

// Builds a CSV string from an array of objects. Uses `??` rather than `||`
// so legitimate falsy values like 0 or false are kept instead of blanked.
export function toCsv(rows, cols) {
    const cell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    return [
        cols.join(","),
        ...rows.map((row) => cols.map((col) => cell(row[col])).join(",")),
    ].join("\n");
}
