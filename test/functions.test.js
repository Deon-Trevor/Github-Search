import test from "node:test";
import assert from "node:assert/strict";
import { githubPath, RequestError } from "../lib/github.js";
import { handleApi, onRequest as onApiRequest } from "../functions/api/[[path]].js";
import { createHandler, onRequest as onMcpRequest } from "../functions/mcp.js";
import { API, setTokenProvider } from "../public/assets/api.js";

test("GitHub paths stay inside the supported lookup contract", () => {
  assert.equal(githubPath("search", { type: "repositories", q: "owner:Deon-Trevor", page: 2 }), "/search/repositories?q=owner%3ADeon-Trevor&per_page=20&page=2");
  assert.equal(githubPath("repos", { login: "octocat" }), "/users/octocat/repos?per_page=30&page=1&sort=updated");
  assert.equal(githubPath("search", { type: "users", q: "syncpundit", sort: "joined", order: "desc" }), "/search/users?q=syncpundit&per_page=20&page=1&sort=joined&order=desc");
  assert.equal(githubPath("repos", { login: "octocat", sort: "pushed" }), "/users/octocat/repos?per_page=30&page=1&sort=pushed");
  assert.equal(githubPath("orgRepos", { login: "github", sort: "pushed" }), "/orgs/github/repos?per_page=30&page=1&sort=pushed&type=public");
  assert.throws(() => githubPath("user", { login: "../admin" }), RequestError);
  assert.throws(() => githubPath("search", { type: "bogus", q: "x" }), RequestError);
  assert.throws(() => githubPath("search", { type: "code", q: "x", page: 11 }), RequestError);
  assert.throws(() => githubPath("search", { type: "users", q: "x", order: "newest" }), RequestError);
  assert.throws(() => githubPath("repos", { login: "octocat", sort: "joined" }), RequestError);
});

test("REST and MCP forward request tokens through the same GitHub lookup", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, headers: init.headers });
    return new Response(JSON.stringify({ login: "Deon-Trevor", public_repos: 42 }), {
      status: 200, headers: { "content-type": "application/json", "x-ratelimit-remaining": "4999" },
    });
  };
  const api = request => handleApi(request, { fetchImpl });
  const base = "https://github.syncpundit.io";
  const user = await api(new Request(`${base}/api/v1/users/Deon-Trevor`, { headers: { "X-GitHub-Token": "test-token" } }));
  assert.equal(user.status, 200);
  assert.equal(user.headers.get("x-ratelimit-remaining"), "4999");
  assert.equal((await user.json()).login, "Deon-Trevor");
  assert.equal(calls[0].url, "https://api.github.com/users/Deon-Trevor");
  assert.equal(calls[0].headers.Authorization, "Bearer test-token");

  const mcp = createHandler({ fetchImpl });
  const list = await mcpCall(mcp, base, "tools/list", {});
  assert.deepEqual(list.result.tools.map(tool => tool.name), ["get_user", "list_user_repos", "list_org_repos", "search_github", "list_repo_labels"]);
  const call = await mcpCall(mcp, base, "tools/call", { name: "get_user", arguments: { login: "Deon-Trevor" } }, { "X-GitHub-Token": "mcp-token" });
  assert.equal(call.result.structuredContent.result.login, "Deon-Trevor");
  assert.equal(calls[1].headers.Authorization, "Bearer mcp-token");

  const bad = await api(new Request(`${base}/api/v1/users/nope/repos?page=0`));
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).error, /integer/);
  const unknown = await api(new Request(`${base}/api/v1/missing`));
  assert.equal(unknown.status, 404);
  const cors = await api(new Request(`${base}/api/v1/health`, { headers: { Origin: "https://other.example" } }));
  assert.equal(cors.status, 200);
  assert.equal(cors.headers.get("access-control-allow-origin"), "*");
  assert.match(cors.headers.get("access-control-expose-headers"), /X-RateLimit-Resource/);
  const blocked = await onMcpRequest({ request: new Request(`${base}/mcp`, { method: "POST", headers: { Origin: "https://evil.example" } }) });
  assert.equal(blocked.status, 403);
});

test("REST and MCP preserve search sorting, text matches, repository order, and rate headers", async () => {
  const calls = [];
  const rateHeaders = {
    "x-ratelimit-limit": "30", "x-ratelimit-remaining": "29", "x-ratelimit-used": "1",
    "x-ratelimit-reset": "1800000000", "x-ratelimit-resource": "search", link: "<next>; rel=next",
  };
  const fetchImpl = async (url, init) => {
    calls.push({ url, headers: init.headers });
    return new Response(JSON.stringify({ items: [{ text_matches: [{ fragment: "needle" }] }] }), { headers: rateHeaders });
  };
  const base = "https://github.syncpundit.io";
  const api = request => handleApi(request, { fetchImpl });
  const users = await api(new Request(`${base}/api/v1/search?type=users&q=lookalike&sort=joined&order=desc`));
  assert.equal(calls[0].url, "https://api.github.com/search/users?q=lookalike&per_page=20&page=1&sort=joined&order=desc");
  assert.equal(users.headers.get("x-ratelimit-resource"), "search");
  assert.equal(users.headers.get("x-ratelimit-used"), "1");
  assert.equal(users.headers.get("link"), "<next>; rel=next");
  const code = await api(new Request(`${base}/api/v1/search?type=code&q=needle`));
  assert.equal(calls[1].headers.Accept, "application/vnd.github.text-match+json");
  assert.equal((await code.json()).items[0].text_matches[0].fragment, "needle");
  await api(new Request(`${base}/api/v1/users/octocat/repos?sort=pushed`));
  assert.equal(calls[2].url, "https://api.github.com/users/octocat/repos?per_page=30&page=1&sort=pushed");
  await api(new Request(`${base}/api/v1/orgs/github/repos?sort=pushed`));
  assert.equal(calls[3].url, "https://api.github.com/orgs/github/repos?per_page=30&page=1&sort=pushed&type=public");

  const mcp = createHandler({ fetchImpl });
  await mcpCall(mcp, base, "tools/call", { name: "search_github", arguments: { type: "commits", q: "needle", sort: "author-date", order: "asc" } });
  assert.equal(calls[4].headers.Accept, "application/vnd.github.text-match+json");
  assert.match(calls[4].url, /sort=author-date&order=asc/);
  await mcpCall(mcp, base, "tools/call", { name: "list_org_repos", arguments: { login: "github", sort: "pushed" } });
  assert.match(calls[5].url, /\/orgs\/github\/repos\?.*sort=pushed/);

  const limited = await handleApi(new Request(`${base}/api/v1/search?type=users&q=x`), {
    fetchImpl: async () => new Response(JSON.stringify({ message: "Secondary rate limit" }), {
      status: 429, headers: { ...rateHeaders, "retry-after": "42" },
    }),
  });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "42");
  assert.equal(limited.headers.get("x-ratelimit-resource"), "search");
  assert.equal(limited.headers.get("x-ratelimit-used"), "1");
});

test("the server token is the default and a caller token takes precedence", async () => {
  const sent = [];
  const fetchImpl = async (_url, init) => {
    sent.push(init.headers.Authorization);
    return Response.json({ login: "octocat" });
  };
  const base = "https://github.syncpundit.io";
  const api = request => handleApi(request, { fetchImpl, defaultToken: "server-token" });
  await api(new Request(`${base}/api/v1/users/octocat`));
  await api(new Request(`${base}/api/v1/users/octocat`, { headers: { "X-GitHub-Token": "caller-token" } }));
  const mcp = createHandler({ fetchImpl, defaultToken: "server-token" });
  await mcpCall(mcp, base, "tools/call", { name: "get_user", arguments: { login: "octocat" } });
  await mcpCall(mcp, base, "tools/call", { name: "get_user", arguments: { login: "octocat" } }, { "X-GitHub-Token": "mcp-token" });
  assert.deepEqual(sent, ["Bearer server-token", "Bearer caller-token", "Bearer server-token", "Bearer mcp-token"]);
});

test("Pages passes the configured secret into REST and MCP requests", async () => {
  const originalFetch = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (_url, init) => {
    sent.push(init.headers.Authorization);
    return Response.json({ login: "octocat" });
  };
  try {
    const base = "https://github.syncpundit.io";
    const env = { GITHUB_TOKEN: "env-token" };
    const api = await onApiRequest({ request: new Request(`${base}/api/v1/users/octocat`), env });
    assert.equal(api.status, 200);
    const mcp = { fetch: request => onMcpRequest({ request, env }) };
    const result = await mcpCall(mcp, base, "tools/call", { name: "get_user", arguments: { login: "octocat" } });
    assert.equal(result.result.structuredContent.result.login, "octocat");
    assert.deepEqual(sent, ["Bearer env-token", "Bearer env-token"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("browser requests use the site API until a personal token is entered", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  let token = "";
  setTokenProvider(() => token);
  globalThis.fetch = async (url, init) => {
    calls.push({ url, headers: init.headers });
    return Response.json({ login: "octocat" });
  };
  try {
    await API.user("octocat");
    assert.equal(calls[0].url, "/api/v1/users/octocat");
    assert.equal(calls[0].headers.Authorization, undefined);
    token = "personal-token";
    await API.user("octocat");
    assert.equal(calls[1].url, "https://api.github.com/users/octocat");
    assert.equal(calls[1].headers.Authorization, "Bearer personal-token");
    assert.equal(await API.verifyToken(token), "octocat");
    assert.equal(calls[2].url, "https://api.github.com/user");
    assert.equal(calls[2].headers.Authorization, "Bearer personal-token");
  } finally {
    globalThis.fetch = originalFetch;
    setTokenProvider(() => "");
  }
});

async function mcpCall(handler, base, method, params, extraHeaders = {}) {
  const response = await handler.fetch(new Request(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...extraHeaders },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }));
  assert.equal(response.status, 200);
  const body = await response.text();
  const line = body.split("\n").find(value => value.startsWith("data: "));
  return JSON.parse(line.slice(6));
}
