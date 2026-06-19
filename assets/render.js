/* ========================================================================
   render.js - safe DOM rendering for the investigation console.
   ======================================================================== */

import { el } from "./dom.js";
import { state, PRESETS, BUILDER_TOKENS } from "./state.js";

const PLACEHOLDER_AVATAR = "assets/github-mark-white.svg";

function clear(node) {
    node.replaceChildren();
}

function text(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value ?? "";
    return node;
}

function link(href, className, value) {
    const node = document.createElement("a");
    node.href = href || "#";
    node.target = "_blank";
    node.rel = "noreferrer noopener";
    node.className = className;
    node.textContent = value || href || "Open";
    return node;
}

function button(label, className, dataset = {}) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = className;
    node.textContent = label;
    Object.entries(dataset).forEach(([key, value]) => {
        if (value !== undefined && value !== null) node.dataset[key] = String(value);
    });
    return node;
}

function img(src, className, alt) {
    const node = document.createElement("img");
    node.src = src || PLACEHOLDER_AVATAR;
    node.alt = alt || "";
    node.className = className;
    node.loading = "lazy";
    node.referrerPolicy = "no-referrer";
    node.onerror = () => {
        node.src = PLACEHOLDER_AVATAR;
    };
    return node;
}

function metaPill(value) {
    const node = document.createElement("span");
    node.className = "meta-pill";
    node.textContent = value;
    return node;
}

function resultShell(kind) {
    const article = document.createElement("article");
    article.className = `result-row result-${kind}`;
    return article;
}

export function toast(msg, type = "info", timeout = 2500) {
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

export function setError(msg) {
    if (!msg) {
        el.errorBanner.classList.add("hidden");
        el.errorBanner.textContent = "";
        return;
    }
    el.errorBanner.textContent = msg;
    el.errorBanner.classList.remove("hidden");
}

export function updateRateDisplay(remaining, limit) {
    if (remaining === null || remaining === undefined || !limit) {
        el.rateRemaining.textContent = "-";
        el.ratePill.title = "No GitHub rate-limit data yet.";
        return;
    }
    el.rateRemaining.textContent = `${remaining}/${limit}`;
    el.ratePill.title = `GitHub API remaining: ${remaining} of ${limit}`;
    el.ratePill.classList.remove("rate-green", "rate-yellow", "rate-red");
    const pct = Number(remaining) / Number(limit);
    if (pct > 0.5) el.ratePill.classList.add("rate-green");
    else if (pct > 0.2) el.ratePill.classList.add("rate-yellow");
    else el.ratePill.classList.add("rate-red");
}

export function renderState(target, { kind = "empty", title, copy, kicker }) {
    clear(target);
    const box = document.createElement("div");
    box.className = `state-card state-${kind}`;
    if (kicker) box.append(text("p", "empty-kicker", kicker));
    box.append(text("p", "empty-title", title));
    if (copy) box.append(text("p", "empty-copy", copy));
    target.append(box);
}

export function setProfileActionsEnabled(enabled) {
    [el.btnCopyProfileURL, el.btnExportJson, el.btnExportCsv].forEach((btn) => {
        if (btn) btn.disabled = !enabled;
    });
}

export function setGlobalActionsEnabled(enabled) {
    if (el.btnCopyGlobalURL) el.btnCopyGlobalURL.disabled = !enabled;
}

export function renderProfileCard(user) {
    clear(el.profileCard);
    el.profileCard.classList.remove("hidden");

    const card = document.createElement("div");
    card.className = "profile-summary";
    card.append(img(user.avatar_url, "avatar-lg", `${user.login} avatar`));

    const content = document.createElement("div");
    content.className = "profile-copy";
    content.append(text("p", "eyebrow", user.type || "GitHub account"));
    content.append(text("h2", "profile-name", user.name || user.login));
    content.append(link(user.html_url, "profile-login", `@${user.login}`));
    if (user.bio) content.append(text("p", "profile-bio", user.bio));

    const stats = document.createElement("div");
    stats.className = "stat-grid";
    stats.append(metaPill(`Followers ${user.followers ?? 0}`));
    stats.append(metaPill(`Following ${user.following ?? 0}`));
    stats.append(metaPill(`Repos ${user.public_repos ?? 0}`));
    if (user.location) stats.append(metaPill(user.location));
    content.append(stats);

    card.append(content);
    el.profileCard.append(card);
}

export function repoCardNode(repo, { titleOverride, showWatchers = false } = {}) {
    const owner = repo.owner?.login || "";
    const name = repo.name || "repository";
    const title = titleOverride || name;
    const article = resultShell("repo");
    article.dataset.owner = owner;
    article.dataset.repo = name;

    const main = document.createElement("div");
    main.className = "result-main";
    main.append(link(repo.html_url, "result-title", title));
    if (repo.description) main.append(text("p", "result-desc", repo.description));

    const meta = document.createElement("div");
    meta.className = "result-meta";
    if (repo.language) meta.append(metaPill(repo.language));
    meta.append(metaPill(`Stars ${repo.stargazers_count ?? 0}`));
    meta.append(metaPill(`Forks ${repo.forks_count ?? 0}`));
    if (showWatchers) meta.append(metaPill(`Watchers ${repo.watchers ?? 0}`));
    if (repo.updated_at) meta.append(metaPill(`Updated ${new Date(repo.updated_at).toLocaleDateString()}`));
    main.append(meta);

    const actions = document.createElement("div");
    actions.className = "row-actions";
    actions.append(button("Labels", "btn-action", { action: "labels", owner, repo: name }));
    if (owner) actions.append(button("Scan owner", "btn-use-user", { login: owner }));

    article.append(main, actions);
    return article;
}

export function renderRepoPage() {
    const start = (state.page - 1) * state.pageSize;
    const slice = state.filtered.slice(start, start + state.pageSize);
    const totalPages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));

    el.repoCount.textContent = state.filtered.length;
    el.repoPage.textContent = state.page;
    el.btnPrev.disabled = state.page <= 1;
    el.btnNext.disabled = state.page >= totalPages;

    clear(el.repoGrid);
    if (!state.user) {
        renderState(el.repoGrid, {
            title: "No repository surface yet.",
            copy: "Run a profile scan to fetch repositories, then filter, export, or inspect labels.",
        });
        return;
    }
    if (!slice.length) {
        renderState(el.repoGrid, {
            title: "No repositories match this filter.",
            copy: "Clear or loosen the repo filter to restore the full repository surface.",
        });
        return;
    }
    slice.forEach((repo) => el.repoGrid.append(repoCardNode(repo, { showWatchers: true })));
}

export function renderUserResults(target, items, { allowUse = true } = {}) {
    clear(target);
    if (!items.length) {
        renderState(target, {
            title: "No users found.",
            copy: "Try punctuation variants, spaces, underscores, or a known repo/domain term.",
        });
        return;
    }

    items.forEach((item) => {
        target.append(userResultNode(item, { allowUse }));
    });
}

function userResultNode(item, { allowUse = true } = {}) {
    const article = resultShell("user");
    article.append(img(item.avatar_url, "avatar-sm", `${item.login} avatar`));

    const main = document.createElement("div");
    main.className = "result-main";
    main.append(link(item.html_url, "result-title", `@${item.login}`));
    const meta = document.createElement("div");
    meta.className = "result-meta";
    meta.append(metaPill(item.type || "User"));
    if (typeof item.score === "number") meta.append(metaPill(`Score ${item.score.toFixed(1)}`));
    main.append(meta);

    const actions = document.createElement("div");
    actions.className = "row-actions";
    if (allowUse) actions.append(button("Scan", "btn-use-user", { login: item.login }));
    actions.append(link(item.html_url, "btn-action", "GitHub"));

    article.append(main, actions);
    return article;
}

export function renderIssueNode(item) {
    const repoURL = (item.repository_url || "").split("/").slice(-2);
    const owner = repoURL[0] || "";
    const repo = repoURL[1] || "";
    const article = resultShell("issue");
    article.dataset.owner = owner;
    article.dataset.repo = repo;

    const main = document.createElement("div");
    main.className = "result-main";
    main.append(link(item.html_url, "result-title", item.title || "Issue"));
    const meta = document.createElement("div");
    meta.className = "result-meta";
    if (owner && repo) meta.append(metaPill(`${owner}/${repo}`));
    if (item.number) meta.append(metaPill(`#${item.number}`));
    if (item.state) meta.append(metaPill(item.state));
    main.append(meta);

    const actions = document.createElement("div");
    actions.className = "row-actions";
    if (owner && repo) actions.append(button("Labels", "btn-action", { action: "labels", owner, repo }));
    article.append(main, actions);
    return article;
}

export function renderGlobalResults(kind, items) {
    clear(el.globalResults);
    if (!items.length) {
        renderState(el.globalResults, {
            title: "No results found.",
            copy: "Try a broader alias, remove qualifiers, or switch search type.",
        });
        return;
    }

    items.forEach((item) => {
        if (kind === "repositories") el.globalResults.append(repoCardNode(item, { titleOverride: item.full_name }));
        else if (kind === "users") el.globalResults.append(userResultNode(item, { allowUse: true }));
        else if (kind === "issues") el.globalResults.append(renderIssueNode(item));
        else {
            const article = resultShell("raw");
            const main = document.createElement("div");
            main.className = "result-main";
            main.append(link(item.html_url, "result-title", item.name || item.title || item.path || item.full_name || item.login || "GitHub result"));
            main.append(text("pre", "raw-json", JSON.stringify(item, null, 2).slice(0, 1400)));
            article.append(main);
            el.globalResults.append(article);
        }
    });
}

export function renderChips() {
    if (!el.presetChips || !el.builderChips) return;
    clear(el.presetChips);
    clear(el.builderChips);
    PRESETS.forEach((preset, index) => {
        el.presetChips.append(button(preset.label, "chip", { preset: index }));
    });
    BUILDER_TOKENS.forEach((token, index) => {
        el.builderChips.append(button(token.label, "chip", { token: index }));
    });
}

export function renderLabelList(labels) {
    clear(el.modalList);
    if (!labels.length) {
        renderState(el.modalList, { title: "No labels found.", copy: "This repository does not expose labels." });
        return;
    }
    labels.forEach((lb) => {
        const row = document.createElement("div");
        row.className = "label-row";
        row.append(text("span", "", lb.name));
        const color = text("span", "label-color", `#${lb.color}`);
        color.style.color = `#${lb.color}`;
        row.append(color);
        el.modalList.append(row);
    });
}
