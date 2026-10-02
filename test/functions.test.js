import test from "node:test";
import assert from "node:assert/strict";
import { githubPath, RequestError } from "../lib/github.js";
import { handleApi, onRequest as onApiRequest } from "../functions/api/[[path]].js";
import { createHandler, onRequest as onMcpRequest } from "../functions/mcp.js";
import { API, setTokenProvider } from "../public/assets/api.js";

test("GitHub paths stay inside the supported lookup contract", () => {
  assert.equal(githubPath("search", { type: "repositories", q: "owner:Deon-Trevor", page: 2 }), "/search/repositories?q=owner%3ADeon-Trevor&per_page=20&page=2");
  assert.throws(() => githubPath("user", { login: "../admin" }), RequestError);
  assert.throws(() => githubPath("search", { type: "bogus", q: "x" }), RequestError);
  assert.throws(() => githubPath("search", { type: "code", q: "x", page: 11 }), RequestError);
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
  assert.deepEqual(list.result.tools.map(tool => tool.name), ["get_user", "list_user_repos", "search_github", "list_repo_labels"]);
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
  const blocked = await onMcpRequest({ request: new Request(`${base}/mcp`, { method: "POST", headers: { Origin: "https://evil.example" } }) });
  assert.equal(blocked.status, 403);
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
