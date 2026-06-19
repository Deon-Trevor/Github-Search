/* ==========================================================================
   state.js — the single mutable state object, plus static lookup data
   (search presets and query-builder tokens). Importing this module gives
   every other module a reference to the *same* state object, so mutations
   made in events.js are immediately visible to render.js.
   ========================================================================== */

export const state = {
    mode: "profile",
    user: null,
    repos: [],
    filtered: [],
    page: 1,
    pageSize: 20,
    userSearchResults: []
};

export const PRESETS = [
    { label: "Most starred", query: "stars:>1000", kind: "repositories" },
    { label: "Created this year", query: "created:>2026-01-01", kind: "repositories" },
    { label: "Open issues", query: "is:open is:issue", kind: "issues" },
    { label: "Organizations", query: "type:org", kind: "users" },
];

export const BUILDER_TOKENS = [
    { label: "in:name", token: "in:name" },
    { label: "in:description", token: "in:description" },
    { label: "language:", token: "language:" },
    { label: "stars:>", token: "stars:>" },
    { label: "is:public", token: "is:public" },
    { label: "archived:false", token: "archived:false" },
];
