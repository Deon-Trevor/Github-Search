# Detective mode (night theme)

## What it does

**Detective mode** is an optional dark skin for the whole app, styled as a noir case file. The page goes near-black, with moonlit off-white text, a searchlight-yellow accent in place of the red, and a faint searchlight glow in the top-right corner. The classic light design is unchanged and is still the default.

## How to use it

- Click **Detective mode** (the magnifying-glass button) in the top navigation. On phone-width screens it shows just the magnifying-glass icon.
- Click it again to go back to the classic theme.
- The choice is saved in this browser and applied on the next visit before the page draws, so there's no flash of the light theme.
- The button is a toggle with `aria-pressed`, so screen readers announce whether it's on. It works with Tab and Enter/Space.

## How it works

All colors in `styles.css` come from CSS custom properties (tokens) on `:root`. The theme is just a second set of token values:

```css
:root { --paper: #f4f1e9; --ink: #171b20; --signal: #d4472e; ... }                      /* classic */
:root[data-theme="detective"] { --paper: #0c0e11; --ink: #e7e3d8; --signal: #f2c230; ... } /* detective */
```

Turning the theme on sets `<html data-theme="detective">`, and every rule picks up the new values.

To make that possible, about fifteen colors that were hard-coded (white input backgrounds, row hover tints, the token-status greens and reds, the modal backdrop, offset shadows, and so on) became tokens with **exactly the same values**. The classic theme renders pixel-for-pixel the same as before, and a browser screenshot comparison confirmed it.

| File | Role |
| --- | --- |
| `public/assets/styles.css` | The new tokens on `:root` (`--field`, `--on-ink`, `--on-signal`, `--hover-tint`, `--row-hover`, `--tab-index-active`, `--placeholder`, `--error-wash`, `--ok`, `--danger`, `--warn`, `--shadow`, `--backdrop`, `--grain`, `--signal-glow`), the `:root[data-theme="detective"]` block, the searchlight background and the `.theme-toggle` button. |
| `public/assets/theme.js` | `normalizeTheme`, `nextTheme`, `loadTheme`, `saveTheme` and `applyTheme(theme, { toggle, themeColorMeta })`. Has no DOM imports, so the logic is unit-testable. |
| `public/index.html` | The toggle button and an early script before the stylesheet. The script resolves the saved choice and sets both the page theme and browser theme color. |
| `public/assets/dom.js` | Caches `el.themeToggle` and `el.themeColorMeta`. |
| `public/assets/events.js` | `init()` adopts the early script's choice without re-reading storage. The toggle's click handler switches, saves, and shows a toast. |

Other details:

- `color-scheme: dark` is set in the theme, so native controls (select dropdowns, checkboxes, scrollbars) also turn dark.
- The `<meta name="theme-color">` switches too, so mobile browser chrome matches.
- If `localStorage` is blocked (some private modes, sandboxed embeds), the theme still works for the visit. It just isn't remembered.
- Accessing the storage object, reading it, and writing it can each fail independently. These failures are caught so the app still initializes and the toggle still works.
- The early choice remains authoritative while modules load. A later storage change cannot reset the theme during initialization. If the early script did not run, the module uses the guarded storage fallback.

## Testing

### Automated

```bash
npm test
```

`test/theme.test.js` covers:

- theme names: unknown values and prototype names such as `toString` fall back to classic
- saving and loading through storage, including blocked or missing storage
- that the inline pre-paint script in `index.html` uses the same storage key as `theme.js`
- **contrast:** it reads the detective token values straight from `styles.css` and checks that every text/background pair meets WCAG AA (4.5:1). For example, `--ink` on `--paper`, `--muted` on `--surface`, `--on-signal` on `--signal` and `--tab-index-active` on `--ink`. If someone later changes a token to a color that's too faint, this test fails.

### Manual QA

1. Run `npm run dev` and open http://127.0.0.1:8788. The classic theme loads, and the toggle shows **Detective mode**, not pressed.
2. Click the toggle. The whole page turns dark with yellow accents and a toast confirms it.
3. Check each area in Detective mode:
   - Profile scan with results
   - a repo detail modal, including its **Labels** drawer
   - Find people
   - Search GitHub, including presets/chips and raw JSON results
   - the token popover: the input is dark and the verified/rejected colors are still readable
   - the error banner (search for a username that doesn't exist)
   - toasts
4. Reload. It's still Detective mode, with no white flash.
5. Click the toggle again. Classic mode comes back exactly as before.
6. At 375px wide, the toggle is an icon-only round button and the nav fits.
7. Use only the keyboard: Tab to the toggle and press Enter. Focus outlines are visible in both themes.
8. In a private window with storage blocked, toggling still works. It just isn't remembered.

## Maintenance notes

- **Adding a new color:** don't hard-code it. Add a token to `:root`, give it a detective value in the theme block, and use `var(--token)`. If it's text, add the pair to the contrast test.
- **Adding another theme:** add an entry to `THEMES` in `theme.js`, add a `:root[data-theme="<name>"]` block, and decide how the toggle should cycle (for example, a small menu instead of a single button).
- **Following the system dark mode:** to switch automatically for people whose OS is set to dark, have `loadTheme` fall back to `matchMedia("(prefers-color-scheme: dark)")` when nothing is saved, and mirror that in the inline `<head>` script. It isn't the default today, to keep the site's original look unless someone opts in.
- **Storage key:** `gh-explorer-theme` appears in both `theme.js` (`THEME_STORAGE_KEY`) and the inline script in `index.html`. A test checks they match.
