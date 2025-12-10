/* ==========================================================================
   GitHub Explorer — Modular App Logic
   Author: Sync_Pundit
   ========================================================================== */

//
// QUICK HELPERS
//
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const copy = (text) =>
    navigator.clipboard.writeText(text).catch(() => console.warn("Clipboard error"));

//
// STATE
//
const state = {
    mode: "profile",
    user: null,
    repos: [],
    filtered: [],
    page: 1,
    pageSize: 20,
    userSearchResults: []
};

//
// ELEMENT CACHE
//
const el = {
    // Mode
    modeTabs: $$("[data-mode]"),
    panels: {
        profile: $("#panel-profile"),
        userfinder: $("#panel-userfinder"),
        global: $("#panel-global"),
    },

    // Rate
    rateRemaining: $("#rate-remaining"),
    ratePill: $("#rate-pill"),

    // Profile panel
    username: $("#profile-username"),
    repoGrid: $("#repo-grid"),
    repoCount: $("#repo-count"),
    repoPage: $("#repo-page"),
    sort: $("#profile-sort"),
    filter: $("#profile-filter"),
    btnScan: $("#btn-scan"),
    btnClear: $("#btn-clear"),
    btnPrev: $("#btn-prev"),
    btnNext: $("#btn-next"),
    btnExportJson: $("#btn-export-json"),
    btnExportCsv: $("#btn-export-csv"),
    btnCopyProfileURL: $("#btn-copy-profile-url"),
    profileCard: $("#profile-card"),

    // Finder
    finderQuery: $("#finder-query"),
    btnFinderSearch: $("#btn-finder-search"),
    finderResults: $("#finder-results"),

    // Global search
    globalQ: $("#global-q"),
    globalKind: $("#global-kind"),
    btnGlobalSearch: $("#btn-global-search"),
    btnCopyGlobalURL: $("#btn-copy-global-url"),
    globalResults: $("#global-results"),

    // Token
    token: $("#github-token"),

    // Modal
    modal: $("#label-modal"),
    modalPanel: $('[data-modal-panel]'),
    modalList: $("#label-list"),
    modalFilter: $("#label-filter"),
    modalClose: $("#label-close"),

    // System
    errorBanner: $("#error-banner"),
    toastContainer: $("#toast-container"),
};

//
// URL PARAM MANAGER
//
function setURL(key, value) {
    const url = new URL(location);
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
    history.replaceState({}, "", url);
}

//
// TOAST SYSTEM
//
function toast(msg, type = "info", timeout = 2500) {
    const box = document.createElement("div");
    box.className = `toast toast-${type}`;
    box.textContent = msg;
    el.toastContainer.appendChild(box);

    requestAnimationFrame(() => box.classList.add("visible"));

    setTimeout(() => {
        box.classList.remove("visible");
        setTimeout(() => box.remove(), 250);
    }, timeout);
}

//
// ERROR BANNER
//
function setError(msg) {
    if (!msg) {
        el.errorBanner.classList.add("hidden");
        el.errorBanner.textContent = "";
        return;
    }
    el.errorBanner.textContent = msg;
    el.errorBanner.classList.remove("hidden");
}

//
// RATE LIMIT
//
function updateRate(remaining, limit) {
    if (!remaining || !limit) {
        el.rateRemaining.textContent = "–";
        return;
    }
    el.rateRemaining.textContent = `${remaining}/${limit}`;

    el.ratePill.classList.remove(
        "rate-green", "rate-yellow", "rate-red"
    );

    const pct = remaining / limit;
    if (pct > 0.5) el.ratePill.classList.add("rate-green");
    else if (pct > 0.2) el.ratePill.classList.add("rate-yellow");
    else el.ratePill.classList.add("rate-red");
}

//
// GITHUB API WRAPPER
//
async function gh(url, acceptOverride) {
    const headers = {
        Accept: acceptOverride || "application/vnd.github+json",
    };
    if (el.token.value.trim())
        headers.Authorization = `Bearer ${el.token.value.trim()}`;

    const resp = await fetch(url, { headers });
    updateRate(
        resp.headers.get("x-ratelimit-remaining"),
        resp.headers.get("x-ratelimit-limit")
    );

    if (!resp.ok) {
        let err = "GitHub request failed";
        try {
            const j = await resp.json();
            err = j.message || err;
        } catch { }
        throw new Error(err);
    }

    return resp.json();
}

//
// API CALLS
//
const API = {
    user: (u) => gh(`https://api.github.com/users/${encodeURIComponent(u)}`),

    repos: async (u) => {
        let all = [];
        for (let page = 1; page <= 3; page++) {
            const chunk = await gh(
                `https://api.github.com/users/${encodeURIComponent(u)}/repos?per_page=100&page=${page}&sort=updated`
            );
            all.push(...chunk);
            if (chunk.length < 100) break;
        }
        return all;
    },

    searchUsers: (q) =>
        gh(`https://api.github.com/search/users?q=${encodeURIComponent(q)}&per_page=20`),

    search: (type, q) => {
        const base = "https://api.github.com/search";
        const endpoint = {
            repositories: `${base}/repositories`,
            users: `${base}/users`,
            code: `${base}/code`,
            commits: `${base}/commits`,
            issues: `${base}/issues`,
            topics: `${base}/topics`,
        }[type];
        return gh(`${endpoint}?q=${encodeURIComponent(q)}&per_page=20`);
    },

    labels: (owner, repo) =>
        gh(`https://api.github.com/repos/${owner}/${repo}/labels?per_page=100`),
};

//
// MODE SWITCHER
//
function switchMode(mode) {
    state.mode = mode;

    Object.entries(el.panels).forEach(([key, panel]) => {
        panel.classList.toggle("hidden", key !== mode);
    });

    el.modeTabs.forEach((btn) => {
        const active = btn.dataset.mode === mode;
        btn.classList.toggle("active", active);
    });

    setError("");
}

//
// PROFILE RENDER
//
function renderProfileCard(user) {
    el.profileCard.innerHTML = `
    <div class="flex gap-4">
      <img src="${user.avatar_url}" class="avatar-lg" />
      <div>
        <h2 class="text-lg font-semibold">${user.name || user.login}</h2>
        <p class="text-xs text-slate-400">@${user.login}</p>
        ${user.bio ? `<p class="mt-1 text-xs text-slate-400">${user.bio}</p>` : ""}
        <div class="mt-2 flex gap-2 text-xs">
          <span class="stat">Followers: ${user.followers}</span>
          <span class="stat">Following: ${user.following}</span>
          <span class="stat">Repos: ${user.public_repos}</span>
        </div>
      </div>
    </div>
  `;
}

//
// REPO FILTER + SORT
//
function applyFilters() {
    const q = el.filter.value.toLowerCase();

    let repos = [...state.repos];

    const sort = el.sort.value;
    if (sort === "updated") repos.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    else if (sort === "stars") repos.sort((a, b) => b.stargazers_count - a.stargazers_count);
    else if (sort === "name") repos.sort((a, b) => a.name.localeCompare(b.name));

    state.filtered = q
        ? repos.filter((r) =>
            (r.name + " " + (r.description || "")).toLowerCase().includes(q)
        )
        : repos;

    state.page = 1;
    renderRepoPage();
}

//
// REPO LIST RENDER
//
function renderRepoPage() {
    const start = (state.page - 1) * state.pageSize;
    const slice = state.filtered.slice(start, start + state.pageSize);

    el.repoCount.textContent = state.filtered.length;
    el.repoPage.textContent = state.page;

    if (!slice.length) {
        el.repoGrid.innerHTML = `<div class="empty">No repos found.</div>`;
        return;
    }

    el.repoGrid.innerHTML = slice
        .map(
            (r) => `
      <article class="repo-card"
        data-owner="${r.owner.login}"
        data-repo="${r.name}">
        <h3 class="repo-title"><a href="${r.html_url}" target="_blank">${r.name}</a></h3>
        ${r.description ? `<p class="repo-desc">${r.description}</p>` : ""}
        <div class="repo-meta">
          ${r.language ? `<span>${r.language}</span>` : ""}
          <span>★ ${r.stargazers_count}</span>
          <span>⑂ ${r.forks_count}</span>
          <span>👁 ${r.watchers}</span>
        </div>

        <button 
          class="btn-action"
          data-action="labels"
          data-owner="${r.owner.login}"
          data-repo="${r.name}">
          Labels
        </button>
      </article>`
        )
        .join("");
}

//
// PROFILE SCAN
//
async function scanProfile() {
    const username = el.username.value.trim();
    if (!username) return setError("Enter a username.");

    setURL("user", username);
    setURL("search", null);
    setURL("type", null);

    el.profileCard.innerHTML = `<div class="loading">Loading profile…</div>`;
    el.repoGrid.innerHTML = `<div class="loading">Loading repos…</div>`;

    try {
        const [user, repos] = await Promise.all([API.user(username), API.repos(username)]);
        state.user = user;
        state.repos = repos;

        renderProfileCard(user);
        applyFilters();
    } catch (e) {
        setError(e.message);
    }
}

//
// USER FINDER
//
async function runUserFinder() {
    const q = el.finderQuery.value.trim();
    if (!q) return setError("Type a name or username.");

    el.finderResults.innerHTML = `<div class="loading">Searching...</div>`;

    try {
        const data = await API.searchUsers(q);
        state.userSearchResults = data.items;

        el.finderResults.innerHTML = data.items
            .map(
                (u) => `
        <article class="user-card">
          <img src="${u.avatar_url}" class="avatar-sm" />
          <div>
            <a href="${u.html_url}" target="_blank" class="user-link">@${u.login}</a>
            <div class="user-type">${u.type}</div>
          </div>
          <button class="btn-use-user" data-login="${u.login}">Use</button>
        </article>`
            )
            .join("");
    } catch (e) {
        setError(e.message);
    }
}

//
// GLOBAL SEARCH
//
async function runGlobalSearch() {
    const q = el.globalQ.value.trim();
    if (!q) return;

    const type = el.globalKind.value;
    setURL("search", q);
    setURL("type", type);
    setURL("user", null);

    el.globalResults.innerHTML = `<div class="loading">Searching...</div>`;

    try {
        const res = await API.search(type, q);
        renderGlobalResults(type, res.items || res);
    } catch (e) {
        setError(e.message);
    }
}

//
// LABEL MODAL
//
async function openLabelModal(owner, repo) {
    if (!owner || !repo) return;

    el.modalList.innerHTML = `<div class="loading">Loading labels...</div>`;
    el.modal.classList.remove("hidden");
    el.modalPanel.classList.add("visible");

    try {
        const labels = await API.labels(owner, repo);
        el.modalList.innerHTML = labels
            .map(
                (lb) => `
        <div class="label-row">
          <span>${lb.name}</span>
          <span class="label-color" style="color:#${lb.color}">#${lb.color}</span>
        </div>`
            )
            .join("");

        el.modalFilter.value = "";
        el.modalFilter.oninput = () => {
            const q = el.modalFilter.value.toLowerCase();
            [...el.modalList.children].forEach((row) => {
                row.style.display = row.textContent.toLowerCase().includes(q)
                    ? ""
                    : "none";
            });
        };
    } catch {
        el.modalList.innerHTML = `<div class="error">Failed to load labels</div>`;
    }
}

function closeLabelModal() {
    el.modalPanel.classList.remove("visible");
    setTimeout(() => el.modal.classList.add("hidden"), 150);
}

//
// GLOBAL RESULTS RENDER
//
function renderGlobalResults(kind, items) {
    if (!items.length) {
        el.globalResults.innerHTML = `<div class="empty">No results found.</div>`;
        return;
    }

    el.globalResults.innerHTML = items
        .map((item) => {
            if (kind === "repositories") {
                return `
        <article class="repo-card"
          data-owner="${item.owner?.login || ""}"
          data-repo="${item.name}">
          <h3 class="repo-title"><a href="${item.html_url}" target="_blank">${item.full_name}</a></h3>
          <p class="repo-desc">${item.description || ""}</p>
          <div class="repo-meta">
            ${item.language ? `<span>${item.language}</span>` : ""}
            <span>★ ${item.stargazers_count}</span>
            <span>⑂ ${item.forks_count}</span>
          </div>
          <button class="btn-action" data-action="labels" data-owner="${item.owner?.login || ""}" data-repo="${item.name}">
            Labels
          </button>
        </article>`;
            }

            if (kind === "users") {
                return `
        <article class="user-card">
          <img src="${item.avatar_url}" class="avatar-sm" />
          <div>
            <a href="${item.html_url}" target="_blank" class="user-link">@${item.login}</a>
            <div class="user-type">${item.type}</div>
          </div>
        </article>`;
            }

            if (kind === "issues") {
                const repoURL = item.repository_url.split("/").slice(-2);
                const owner = repoURL[0];
                const repo = repoURL[1];
                return `
        <article class="issue-card" data-owner="${owner}" data-repo="${repo}">
          <h3 class="issue-title"><a href="${item.html_url}" target="_blank">${item.title}</a></h3>
          <div class="issue-meta">${owner}/${repo} • #${item.number} • ${item.state}</div>
          <button class="btn-action" data-action="labels" data-owner="${owner}" data-repo="${repo}">
            Labels
          </button>
        </article>`;
            }

            // Fallback simple render:
            return `<pre class="text-xs">${JSON.stringify(item, null, 2)}</pre>`;
        })
        .join("");
}

//
// EVENT LISTENERS
//

// Mode tabs
el.modeTabs.forEach((btn) =>
    btn.addEventListener("click", () => switchMode(btn.dataset.mode))
);

// Profile scan
el.btnScan.addEventListener("click", scanProfile);
el.username.addEventListener("keydown", (e) => e.key === "Enter" && scanProfile());

// Clear profile
el.btnClear.addEventListener("click", () => {
    el.username.value = "";
    el.filter.value = "";
    el.profileCard.innerHTML = "";
    el.repoGrid.innerHTML = "";
    state.user = null;
    state.repos = [];
});

// Filters
el.sort.addEventListener("change", applyFilters);
el.filter.addEventListener("input", () => {
    clearTimeout(applyFilters._t);
    applyFilters._t = setTimeout(applyFilters, 150);
});

// Pagination
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

// Export JSON
el.btnExportJson.addEventListener("click", () => {
    if (!state.filtered.length) return;
    const blob = new Blob([JSON.stringify(state.filtered, null, 2)]);
    const a = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(blob),
        download: `${state.user.login}-repos.json`,
    });
    a.click();
    toast("JSON exported", "success");
});

// Export CSV
el.btnExportCsv.addEventListener("click", () => {
    if (!state.filtered.length) return;

    const cols = [
        "name", "html_url", "description", "language",
        "stargazers_count", "forks_count", "watchers", "updated_at",
    ];

    const csv = [
        cols.join(","),
        ...state.filtered.map((r) =>
            cols.map((c) => `"${String(r[c] || "").replace(/"/g, '""')}"`).join(",")
        ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(blob),
        download: `${state.user.login}-repos.csv`,
    });
    a.click();
    toast("CSV exported", "success");
});

// User finder
el.btnFinderSearch.addEventListener("click", runUserFinder);
el.finderQuery.addEventListener("keydown", (e) => e.key === "Enter" && runUserFinder());

// "Use user"
document.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-use-user");
    if (!btn) return;
    el.username.value = btn.dataset.login;
    switchMode("profile");
    scanProfile();
});

// Global search
el.btnGlobalSearch.addEventListener("click", runGlobalSearch);
el.globalQ.addEventListener("keydown", (e) => e.key === "Enter" && runGlobalSearch());

// Copy profile URL
el.btnCopyProfileURL.addEventListener("click", () => {
    if (!el.username.value) return;
    const link = `${location.origin}${location.pathname}?user=${encodeURIComponent(el.username.value)}`;
    copy(link);
    toast("Profile link copied", "success");
});

// Copy global URL
el.btnCopyGlobalURL.addEventListener("click", () => {
    const q = el.globalQ.value.trim();
    if (!q) return;
    const link = `${location.origin}${location.pathname}?search=${encodeURIComponent(q)}&type=${el.globalKind.value}`;
    copy(link);
    toast("Search link copied", "success");
});

// Label modal open
document.addEventListener("click", (e) => {
    const btn = e.target.closest('.btn-action[data-action="labels"]');
    if (!btn) return;
    openLabelModal(btn.dataset.owner, btn.dataset.repo);
});

// Close modal
el.modalClose.addEventListener("click", closeLabelModal);
el.modal.addEventListener("click", (e) => {
    if (e.target === el.modal) closeLabelModal();
});

//
// DEEP LINK HANDLER
//
(function initDeepLink() {
    const params = new URLSearchParams(location.search);

    if (params.get("user")) {
        switchMode("profile");
        el.username.value = params.get("user");
        scanProfile();
    }

    if (params.get("search")) {
        switchMode("global");
        el.globalQ.value = params.get("search");
        el.globalKind.value = params.get("type") || "repositories";
        runGlobalSearch();
    }

    if (params.get("embed")) {
        document.body.classList.add("embed-mode");
    }
})();