/* ========================================================================
   events.js - controller for UI state, network calls and user interactions.
   ======================================================================== */

import { el } from "./dom.js";
import { state, PRESETS, BUILDER_TOKENS } from "./state.js";
import { copy, setURL } from "./utils.js";
import { API, setTokenProvider, onRateUpdate } from "./api.js";
import {
    toast,
    setError,
    updateRateDisplay,
    renderProfileCard,
    renderRepoPage,
    renderGlobalResults,
    renderChips,
    renderLabelList,
    renderUserResults,
    renderState,
    setProfileActionsEnabled,
    setGlobalActionsEnabled,
} from "./render.js";

let activeRequest = 0;

function friendlyError(error, context = "request") {
    const message = error?.message || "GitHub request failed";
    if (/not found/i.test(message)) return "No exact GitHub user found. Try User Finder for aliases or punctuation variants.";
    if (/rate limit/i.test(message)) return "GitHub rate limit hit. Add a token from Auth, then retry.";
    if (/requires authentication|must be authenticated|validation failed/i.test(message)) {
        return `${context} needs a narrower query or authenticated GitHub token.`;
    }
    return message;
}

function markBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
        button.dataset.idleLabel = button.textContent;
        button.textContent = label || "Working...";
        button.disabled = true;
    } else {
        button.textContent = button.dataset.idleLabel || button.textContent;
        button.disabled = false;
        delete button.dataset.idleLabel;
    }
}

function resetProfileState() {
    state.user = null;
    state.repos = [];
    state.filtered = [];
    state.page = 1;
    el.repoCount.textContent = "0";
    el.repoPage.textContent = "1";
    setProfileActionsEnabled(false);
    renderState(el.profileCard, {
        kicker: "No profile loaded",
        title: "Start with an exact username.",
        copy: "If you only know a real name or alias, use Find Users first, then pivot back into Profile.",
    });
    renderRepoPage();
}

function switchMode(mode) {
    state.mode = mode;
    Object.entries(el.panels).forEach(([key, panel]) => {
        panel.classList.toggle("hidden", key !== mode);
        panel.classList.toggle("active-panel", key === mode);
    });
    el.modeTabs.forEach((btn) => {
        const active = btn.dataset.mode === mode;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    setError("");
}

function applyFilters() {
    const q = el.filter.value.trim().toLowerCase();
    let repos = [...state.repos];
    const sort = el.sort.value;
    if (sort === "updated") repos.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    else if (sort === "stars") repos.sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0));
    else if (sort === "name") repos.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    state.filtered = q
        ? repos.filter((repo) => `${repo.name || ""} ${repo.description || ""} ${repo.language || ""}`.toLowerCase().includes(q))
        : repos;
    state.page = 1;
    renderRepoPage();
}

async function scanProfile() {
    const username = el.username.value.trim();
    if (!username) return setError("Enter an exact GitHub username, or use Find Users first.");

    const requestId = ++activeRequest;
    setError("");
    setURL("user", username);
    setURL("search", null);
    setURL("type", null);
    setProfileActionsEnabled(false);
    markBusy(el.btnScan, true, "Scanning...");
    renderState(el.profileCard, { kind: "loading", title: "Loading profile...", copy: `Fetching @${username} from GitHub.` });
    renderState(el.repoGrid, { kind: "loading", title: "Loading repositories...", copy: "Collecting repo metadata and labels surface." });

    try {
        const user = await API.user(username);
        if (requestId !== activeRequest) return;
        state.user = user;
        renderProfileCard(user);

        const repos = await API.repos(username, user.public_repos);
        if (requestId !== activeRequest) return;
        state.repos = repos;
        applyFilters();
        setProfileActionsEnabled(true);
        toast(`Loaded @${user.login}`, "success");
    } catch (error) {
        if (requestId !== activeRequest) return;
        resetProfileState();
        setError(friendlyError(error, "Profile scan"));
    } finally {
        if (requestId === activeRequest) markBusy(el.btnScan, false);
    }
}

async function runUserFinder() {
    const q = el.finderQuery.value.trim();
    if (!q) return setError("Type a name, alias, or username fragment.");

    const requestId = ++activeRequest;
    setError("");
    markBusy(el.btnFinderSearch, true, "Searching...");
    renderState(el.finderResults, { kind: "loading", title: "Searching users...", copy: `Looking for ${q}` });

    try {
        const data = await API.searchUsers(q);
        if (requestId !== activeRequest) return;
        state.userSearchResults = data.items || [];
        renderUserResults(el.finderResults, state.userSearchResults, { allowUse: true });
    } catch (error) {
        if (requestId !== activeRequest) return;
        renderState(el.finderResults, { title: "User search failed.", copy: friendlyError(error, "User Finder") });
        setError(friendlyError(error, "User Finder"));
    } finally {
        if (requestId === activeRequest) markBusy(el.btnFinderSearch, false);
    }
}

async function runGlobalSearch() {
    const q = el.globalQ.value.trim();
    if (!q) return setError("Enter a GitHub search query.");

    const requestId = ++activeRequest;
    const type = el.globalKind.value;
    setError("");
    setURL("search", q);
    setURL("type", type);
    setURL("user", null);
    setGlobalActionsEnabled(false);
    markBusy(el.btnGlobalSearch, true, "Searching...");
    renderState(el.globalResults, { kind: "loading", title: "Running GitHub search...", copy: `${type}: ${q}` });

    try {
        const res = await API.search(type, q);
        if (requestId !== activeRequest) return;
        renderGlobalResults(type, res.items || res || []);
        setGlobalActionsEnabled(true);
    } catch (error) {
        if (requestId !== activeRequest) return;
        renderState(el.globalResults, { title: "Search failed.", copy: friendlyError(error, "Global Search") });
        setError(friendlyError(error, "Global Search"));
    } finally {
        if (requestId === activeRequest) markBusy(el.btnGlobalSearch, false);
    }
}

function insertToken(token) {
    const current = el.globalQ.value;
    const sep = current && !current.endsWith(" ") ? " " : "";
    el.globalQ.value = current + sep + token;
    el.globalQ.focus();
    el.globalQ.setSelectionRange(el.globalQ.value.length, el.globalQ.value.length);
}

async function openLabelModal(owner, repo) {
    if (!owner || !repo) return;
    renderState(el.modalList, { kind: "loading", title: "Loading labels...", copy: `${owner}/${repo}` });
    el.modal.classList.remove("hidden");
    requestAnimationFrame(() => el.modalPanel.classList.add("visible"));

    try {
        const labels = await API.labels(owner, repo);
        renderLabelList(labels);
        el.modalFilter.value = "";
        el.modalFilter.oninput = () => {
            const q = el.modalFilter.value.toLowerCase();
            [...el.modalList.children].forEach((row) => {
                row.style.display = row.textContent.toLowerCase().includes(q) ? "" : "none";
            });
        };
    } catch {
        renderState(el.modalList, { title: "Failed to load labels.", copy: "GitHub did not return label metadata for this repository." });
    }
}

function closeLabelModal() {
    el.modalPanel.classList.remove("visible");
    setTimeout(() => el.modal.classList.add("hidden"), 150);
}

function bindEvents() {
    el.modeTabs.forEach((btn) => btn.addEventListener("click", () => switchMode(btn.dataset.mode)));

    el.btnScan.addEventListener("click", scanProfile);
    el.username.addEventListener("keydown", (e) => e.key === "Enter" && scanProfile());

    el.btnClear.addEventListener("click", () => {
        el.username.value = "";
        el.filter.value = "";
        resetProfileState();
        setError("");
    });

    el.sort.addEventListener("change", applyFilters);
    el.filter.addEventListener("input", () => {
        clearTimeout(applyFilters._t);
        applyFilters._t = setTimeout(applyFilters, 150);
    });

    el.btnPrev.addEventListener("click", () => {
        if (state.page > 1) {
            state.page--;
            renderRepoPage();
        }
    });
    el.btnNext.addEventListener("click", () => {
        if (state.page * state.pageSize < state.filtered.length) {
            state.page++;
            renderRepoPage();
        }
    });

    el.btnExportJson.addEventListener("click", () => {
        if (!state.filtered.length || !state.user) return;
        const blob = new Blob([JSON.stringify(state.filtered, null, 2)], { type: "application/json" });
        const a = Object.assign(document.createElement("a"), {
            href: URL.createObjectURL(blob),
            download: `${state.user.login}-repos.json`,
        });
        a.click();
        URL.revokeObjectURL(a.href);
        toast("JSON exported", "success");
    });

    el.btnExportCsv.addEventListener("click", () => {
        if (!state.filtered.length || !state.user) return;
        const cols = ["name", "html_url", "description", "language", "stargazers_count", "forks_count", "watchers", "updated_at"];
        const csv = [
            cols.join(","),
            ...state.filtered.map((r) => cols.map((c) => `"${String(r[c] || "").replace(/"/g, '""')}"`).join(",")),
        ].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const a = Object.assign(document.createElement("a"), {
            href: URL.createObjectURL(blob),
            download: `${state.user.login}-repos.csv`,
        });
        a.click();
        URL.revokeObjectURL(a.href);
        toast("CSV exported", "success");
    });

    el.btnFinderSearch.addEventListener("click", runUserFinder);
    el.finderQuery.addEventListener("keydown", (e) => e.key === "Enter" && runUserFinder());

    document.addEventListener("click", (e) => {
        const btn = e.target.closest(".btn-use-user");
        if (!btn) return;
        el.username.value = btn.dataset.login;
        switchMode("profile");
        scanProfile();
    });

    el.btnGlobalSearch.addEventListener("click", runGlobalSearch);
    el.globalQ.addEventListener("keydown", (e) => e.key === "Enter" && runGlobalSearch());

    el.presetChips?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-preset]");
        if (!btn) return;
        const preset = PRESETS[Number(btn.dataset.preset)];
        el.globalQ.value = preset.query;
        if (preset.kind) el.globalKind.value = preset.kind;
        el.globalQ.focus();
    });

    el.builderChips?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-token]");
        if (!btn) return;
        insertToken(BUILDER_TOKENS[Number(btn.dataset.token)].token);
    });

    el.btnCopyProfileURL.addEventListener("click", () => {
        if (!el.username.value) return;
        const link = `${location.origin}${location.pathname}?user=${encodeURIComponent(el.username.value)}`;
        copy(link);
        toast("Profile link copied", "success");
    });

    el.btnCopyGlobalURL.addEventListener("click", () => {
        const q = el.globalQ.value.trim();
        if (!q) return;
        const link = `${location.origin}${location.pathname}?search=${encodeURIComponent(q)}&type=${el.globalKind.value}`;
        copy(link);
        toast("Search link copied", "success");
    });

    document.addEventListener("click", (e) => {
        const btn = e.target.closest('.btn-action[data-action="labels"]');
        if (!btn) return;
        openLabelModal(btn.dataset.owner, btn.dataset.repo);
    });

    el.modalClose.addEventListener("click", closeLabelModal);
    el.modal.addEventListener("click", (e) => {
        if (e.target === el.modal) closeLabelModal();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !el.modal.classList.contains("hidden")) closeLabelModal();
    });
}

function initDeepLink() {
    const params = new URLSearchParams(location.search);
    if (params.get("embed")) document.body.classList.add("embed-mode");
    if (params.get("user")) {
        switchMode("profile");
        el.username.value = params.get("user");
        scanProfile();
        return;
    }
    if (params.get("search")) {
        switchMode("global");
        el.globalQ.value = params.get("search");
        el.globalKind.value = params.get("type") || "repositories";
        runGlobalSearch();
    }
}

export function init() {
    setTokenProvider(() => el.token.value.trim());
    onRateUpdate(updateRateDisplay);
    renderChips();
    resetProfileState();
    bindEvents();
    initDeepLink();
}
