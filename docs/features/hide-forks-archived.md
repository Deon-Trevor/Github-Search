# Hide forks and archived repositories

## What it does

The Profile scan panel has two checkboxes next to the export buttons:

- **Hide forks**: removes repositories that are forks of someone else's project.
- **Hide archived**: removes repositories the owner has archived (read-only).

On accounts with many repositories, forks and archived projects often outnumber the owner's active work. These toggles make it easier to see what the person actually builds and maintains.

## How to use it

1. Scan a profile as usual.
2. Tick **Hide forks**, **Hide archived**, or both. The list updates right away. You don't need to rescan.
3. The toggles work together with **Sort repos** and **Filter visible repos**.
4. **Export JSON** and **Export CSV** export what you currently see, so the toggles also narrow the export.
5. **Reset** unticks both boxes.

The repository count in the heading shows how many repos remain after all filters.

## How it works

| File | Role |
| --- | --- |
| `public/assets/repo-filters.js` | `filterRepos(repos, { query, sort, hideForks, hideArchived })`. A pure function with no DOM or state access. It returns a new sorted, filtered array and never changes its input. |
| `public/assets/events.js` | `applyFilters()` reads the controls, calls `filterRepos`, and stores the result in `state.filtered`. The checkboxes call `applyFilters` on `change`, and Reset clears them. |
| `public/assets/dom.js` | Caches `el.hideForks` and `el.hideArchived`. |
| `public/index.html` | The two checkboxes, inside `.repo-toggles` in the profile `.utility-row`. |
| `public/assets/styles.css` | `.repo-toggles` and `.toggle`. On narrow screens the toggles wrap onto their own line. |

The filter uses the `fork` and `archived` booleans that GitHub already includes in every repository object, so it makes no extra API calls.

The existing text-filter and sort logic moved from `events.js` into `filterRepos` unchanged, so it now has unit tests too.

## Testing

### Automated

```bash
npm test
```

`test/repo-filters.test.js` covers:

- the default, with nothing hidden and repos sorted by last update
- each toggle on its own, and both together
- the toggles combined with the text filter and every sort option
- that the input array is not mutated

### Manual QA

1. Run `npm run dev` and open http://127.0.0.1:8788.
2. Scan a user who has both forks and archived repos.
3. Tick **Hide forks**. The count drops and no remaining repo is a fork on GitHub.
4. Tick **Hide archived**. Open a few repo details and check that **Archived** says "No".
5. Type into **Filter visible repos** and change **Sort repos**. Both still apply on top of the toggles.
6. Go to page 2 or later, then tick a toggle. The list jumps back to page 1.
7. Export CSV. The file contains only the visible repos.
8. Click **Reset**. Both boxes untick and the list is empty again.
9. Narrow the window below 700px. The toggles wrap onto their own row and the page doesn't scroll sideways.
10. Using only the keyboard, Tab to each checkbox and press Space to toggle it.

## Maintenance notes

- To add another filter (for example "Hide private" for token users), add an option to `filterRepos`, add a test case, add a checkbox, cache it in `dom.js`, and wire it into `applyFilters()` and the Reset handler.
- Keep `filterRepos` free of DOM access so it stays testable in Node.
- The toggles aren't saved in the URL, so a copied profile link always opens with nothing hidden.
