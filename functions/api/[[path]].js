import { githubRequest, RequestError, tokenFrom } from "../../lib/github.js";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "X-GitHub-Token",
  "access-control-expose-headers": "X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Used, X-RateLimit-Reset, X-RateLimit-Resource, Retry-After, Link",
};

function json(status, value, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors, ...headers },
  });
}

function route(path, searchParams) {
  const parts = path.split("/").filter(Boolean);
  if (parts[0] !== "api" || parts[1] !== "v1") throw new RequestError(404, "API route not found.");
  if (parts[2] === "health" && parts.length === 3) return { health: true };
  if (parts[2] === "search" && parts.length === 3) {
    return { operation: "search", args: Object.fromEntries(searchParams) };
  }
  if (parts[2] === "users" && parts.length === 4) {
    return { operation: "user", args: { login: parts[3] } };
  }
  if (parts[2] === "users" && parts[4] === "repos" && parts.length === 5) {
    return { operation: "repos", args: { login: parts[3], ...Object.fromEntries(searchParams) } };
  }
  if (parts[2] === "orgs" && parts[4] === "repos" && parts.length === 5) {
    return { operation: "orgRepos", args: { login: parts[3], ...Object.fromEntries(searchParams) } };
  }
  if (parts[2] === "repos" && parts[5] === "labels" && parts.length === 6) {
    return { operation: "labels", args: { owner: parts[3], repo: parts[4], ...Object.fromEntries(searchParams) } };
  }
  throw new RequestError(404, "API route not found.");
}

export async function handleApi(request, { fetchImpl = fetch, defaultToken = "" } = {}) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "GET") return json(405, { error: "Method not allowed." }, { allow: "GET, OPTIONS" });
  try {
    const url = new URL(request.url);
    const target = route(url.pathname, url.searchParams);
    if (target.health) return json(200, { status: "ok" });
    const token = tokenFrom(request.headers) || defaultToken;
    const result = await githubRequest(target.operation, target.args, { token, fetchImpl });
    return json(200, result.data, result.headers);
  } catch (error) {
    const status = error instanceof RequestError ? error.status : 500;
    return json(status, { error: status === 500 ? "Internal server error." : error.message }, error.headers || {});
  }
}

export function onRequest({ request, env }) {
  return handleApi(request, { defaultToken: env?.GITHUB_TOKEN || "" });
}
