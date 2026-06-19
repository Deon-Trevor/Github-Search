/* ==========================================================================
   api.js — the only module that talks to the network. It knows nothing
   about the DOM or app state. It needs two things from the outside world
   (the auth token, and somewhere to report rate-limit headers), and gets
   them through small injected hooks instead of reaching into `el` directly.
   ========================================================================== */

let tokenProvider = () => "";
let rateListener = null;

export function setTokenProvider(fn) {
    tokenProvider = fn;
}

export function onRateUpdate(fn) {
    rateListener = fn;
}

async function gh(url, acceptOverride) {
    const headers = {
        Accept: acceptOverride || "application/vnd.github+json",
    };

    const token = tokenProvider();
    if (token) headers.Authorization = `Bearer ${token}`;

    const resp = await fetch(url, { headers });

    if (rateListener) {
        rateListener(
            resp.headers.get("x-ratelimit-remaining"),
            resp.headers.get("x-ratelimit-limit")
        );
    }

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

export const API = {
    user: (u) => gh(`https://api.github.com/users/${encodeURIComponent(u)}`),

    // Fetches a user's repos. When `expectedCount` (from user.public_repos) is
    // known, only the pages needed to cover that count are requested instead
    // of always pulling a blind 3 pages (up to 300 repos) per scan.
    repos: async (u, expectedCount) => {
        const perPage = 100;
        const maxPages = expectedCount
            ? Math.max(1, Math.ceil(expectedCount / perPage))
            : 3;

        let all = [];
        for (let page = 1; page <= maxPages; page++) {
            const chunk = await gh(
                `https://api.github.com/users/${encodeURIComponent(u)}/repos?per_page=${perPage}&page=${page}&sort=updated`
            );
            all.push(...chunk);
            if (chunk.length < perPage) break;
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
