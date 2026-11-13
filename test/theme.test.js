import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { THEME_STORAGE_KEY, THEMES, normalizeTheme, nextTheme, loadTheme, saveTheme } from "../public/assets/theme.js";

const memoryStorage = (initial = {}) => {
  const data = { ...initial };
  return { getItem: key => (key in data ? data[key] : null), setItem: (key, value) => { data[key] = String(value); }, data };
};
const blockedStorage = { getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("SecurityError"); } };

test("normalizeTheme and nextTheme only ever produce known themes", () => {
  assert.equal(normalizeTheme("detective"), "detective");
  for (const value of [null, undefined, "", "dark", "toString", "__proto__"]) assert.equal(normalizeTheme(value), "classic", String(value));
  assert.equal(nextTheme("classic"), "detective");
  assert.equal(nextTheme("detective"), "classic");
  assert.equal(nextTheme(undefined), "detective");
});

test("loadTheme and saveTheme round-trip through storage", () => {
  const storage = memoryStorage();
  assert.equal(loadTheme(storage), "classic");
  saveTheme("detective", storage);
  assert.equal(storage.data[THEME_STORAGE_KEY], "detective");
  assert.equal(loadTheme(storage), "detective");
  saveTheme("bogus", storage);
  assert.equal(loadTheme(storage), "classic");
});

test("blocked or missing storage falls back to classic without throwing", () => {
  assert.equal(loadTheme(blockedStorage), "classic");
  assert.doesNotThrow(() => saveTheme("detective", blockedStorage));
  assert.equal(loadTheme(undefined), "classic");
  assert.doesNotThrow(() => saveTheme("detective", undefined));
});

test("storage access itself can fail without blocking load or save", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  try {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("SecurityError"); } });
    assert.equal(loadTheme(), "classic");
    assert.doesNotThrow(() => saveTheme("detective"));
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
  }
});

test("the early script resolves both page and browser colors before CSS, including storage failure", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const script = html.match(/<script id="theme-bootstrap">([\s\S]*?)<\/script>/)[1];
  assert.ok(html.indexOf('id="theme-bootstrap"') < html.indexOf('rel="stylesheet"'));
  for (const saved of ["detective", "classic", "unknown", null]) {
    const dataset = {};
    const attrs = {};
    runInNewContext(script, {
      localStorage: memoryStorage({ [THEME_STORAGE_KEY]: saved }),
      document: { documentElement: { dataset }, querySelector: () => ({ setAttribute: (key, value) => { attrs[key] = value; } }) },
    });
    const expected = normalizeTheme(saved);
    assert.equal(dataset.theme, expected);
    assert.equal(attrs.content, THEMES[expected].themeColor);
  }
  for (const mode of ["getter", "method"]) {
    const dataset = {};
    const sandbox = { document: { documentElement: { dataset }, querySelector: () => ({ setAttribute() {} }) } };
    Object.defineProperty(sandbox, "localStorage", { get() { if (mode === "getter") throw new Error("SecurityError"); return blockedStorage; } });
    assert.doesNotThrow(() => runInNewContext(script, sandbox));
    assert.equal(dataset.theme, "classic");
  }
});

// WCAG 2 contrast ratio between two #rrggbb colors.
function contrast(a, b) {
  const lum = hex => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test("Detective theme text colors meet WCAG AA contrast (4.5:1) on their backgrounds", () => {
  const css = readFileSync(new URL("../public/assets/styles.css", import.meta.url), "utf8");
  const block = css.match(/:root\[data-theme="detective"\] \{([^}]*)\}/)[1];
  const t = Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map(m => [m[1], m[2]]));
  const pairs = [
    ["ink", "paper"], ["ink", "surface"], ["ink-soft", "surface"], ["ink-soft", "paper"], ["muted", "surface"], ["muted", "paper"],
    ["signal-dark", "surface"], ["signal-dark", "paper"], ["signal", "surface"], ["on-signal", "signal"], ["on-ink", "ink"],
    ["ink", "field"], ["signal-dark", "error-wash"], ["tab-index-active", "ink"],
    ["placeholder", "field"], ["surface", "ok"], ["surface", "danger"],
  ];
  for (const [fg, bg] of pairs) {
    const ratio = contrast(t[fg], t[bg]);
    assert.ok(ratio >= 4.5, `--${fg} on --${bg} is ${ratio.toFixed(2)}:1`);
  }
  assert.equal(THEMES.detective.themeColor, t.paper, "browser theme-color matches the page background");
});
