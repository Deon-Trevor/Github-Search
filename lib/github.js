const TYPES = new Set(["repositories", "users", "code", "commits", "issues", "topics"]);
const NAME = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;
const REPO = /^[A-Za-z0-9_.-]{1,100}$/;

export class RequestError extends Error {
  constructor(status, message, headers = {}) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

export function tokenFrom(headers) {
  const value = headers.get("x-github-token") || "";
  if (value && (value.length > 512 || /[^\x21-\x7e]/.test(value))) {
    throw new RequestError(400, "Invalid X-GitHub-Token header.");
  }
  return value;
}

function valid(value, pattern, label) {
  if (!pattern.test(value || "")) throw new RequestError(400, `Invalid ${label}.`);
  return value;
}

function number(value, fallback, max) {
  const parsed = value === undefined || value === null || value === "" ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new RequestError(400, `Expected an integer from 1 to ${max}.`);
  }
  return parsed;
}

export function githubPath(operation, args = {}) {
  const params = new URLSearchParams();
  if (operation === "user") return `/users/${valid(args.login, NAME, "login")}`;
  if (operation === "repos") {
    params.set("per_page", String(number(args.per_page, 30, 100)));
    params.set("page", String(number(args.page, 1, 100)));
    params.set("sort", "updated");
    return `/users/${valid(args.login, NAME, "login")}/repos?${params}`;
  }
  if (operation === "labels") {
    params.set("per_page", String(number(args.per_page, 100, 100)));
    params.set("page", String(number(args.page, 1, 100)));
    return `/repos/${valid(args.owner, NAME, "owner")}/${valid(args.repo, REPO, "repository")}/labels?${params}`;
  }
  if (operation === "search") {
    if (!TYPES.has(args.type)) throw new RequestError(400, "Invalid search type.");
    const q = String(args.q || "").trim();
    if (!q || q.length > 256) throw new RequestError(400, "Search query must be 1 to 256 characters.");
    params.set("q", q);
    params.set("per_page", String(number(args.per_page, 20, 100)));
    params.set("page", String(number(args.page, 1, 10)));
    return `/search/${args.type}?${params}`;
  }
  throw new RequestError(404, "Unknown operation.");
}

export async function githubRequest(operation, args, { token = "", fetchImpl = fetch } = {}) {
  const path = githubPath(operation, args);
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "syncpundit-github-explorer",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetchImpl(`https://api.github.com${path}`, {
      headers,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new RequestError(502, "GitHub is unavailable.");
  }
  const rateHeaders = {};
  for (const name of ["x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset", "link"]) {
    const value = response.headers.get(name);
    if (value) rateHeaders[name] = value;
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new RequestError(response.status, data?.message || "GitHub request failed.", rateHeaders);
  return { data, headers: rateHeaders };
}
