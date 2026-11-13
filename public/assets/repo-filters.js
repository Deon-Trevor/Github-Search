/* ==========================================================================
   repo-filters.js — pure sorting/filtering for the profile repo list.
   No DOM or state access, so it can be unit-tested in Node.
   ========================================================================== */

/**
 * Returns a new, sorted and filtered copy of `repos`.
 *
 * @param {object[]} repos  Repository objects from the GitHub API.
 * @param {object}   opts
 * @param {string}   [opts.query=""]          Case-insensitive text matched against name, description and language.
 * @param {string}   [opts.sort="updated"]    "updated" | "stars" | "name".
 * @param {boolean}  [opts.hideForks=false]   Drop repos where `fork` is true.
 * @param {boolean}  [opts.hideArchived=false] Drop repos where `archived` is true.
 */
export function filterRepos(repos, { query = "", sort = "updated", hideForks = false, hideArchived = false } = {}) {
    const q = query.trim().toLowerCase();
    const list = repos.filter((repo) => {
        if (hideForks && repo.fork) return false;
        if (hideArchived && repo.archived) return false;
        if (!q) return true;
        return `${repo.name || ""} ${repo.description || ""} ${repo.language || ""}`.toLowerCase().includes(q);
    });

    if (sort === "updated") list.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    else if (sort === "stars") list.sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0));
    else if (sort === "name") list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return list;
}
