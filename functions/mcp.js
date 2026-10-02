import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { githubRequest, tokenFrom } from "../lib/github.js";

export function createHandler({ fetchImpl = fetch, defaultToken = "" } = {}) {
  return createMcpHandler(() => {
    const server = new McpServer({ name: "github-explorer", version: "1.0.0" });
    const tool = (name, description, inputSchema, operation) => {
      server.registerTool(name, { description, inputSchema }, async (args, ctx) => {
        try {
          const token = tokenFrom(ctx.http?.req?.headers || new Headers()) || defaultToken;
          const result = await githubRequest(operation, args, { token, fetchImpl });
          return {
            content: [{ type: "text", text: JSON.stringify(result.data) }],
            structuredContent: { result: result.data },
          };
        } catch (error) {
          return { isError: true, content: [{ type: "text", text: error.message }] };
        }
      });
    };
    tool("get_user", "Get a GitHub profile by exact login.", z.object({ login: z.string() }), "user");
    tool("list_user_repos", "List public repositories for a GitHub user, newest updated first.", z.object({
      login: z.string(), page: z.number().int().min(1).max(100).optional(), per_page: z.number().int().min(1).max(100).optional(),
    }), "repos");
    tool("search_github", "Search GitHub repositories, users, code, commits, issues, or topics.", z.object({
      type: z.enum(["repositories", "users", "code", "commits", "issues", "topics"]),
      q: z.string().min(1).max(256), page: z.number().int().min(1).max(10).optional(),
      per_page: z.number().int().min(1).max(100).optional(),
    }), "search");
    tool("list_repo_labels", "List labels for a GitHub repository.", z.object({
      owner: z.string(), repo: z.string(), page: z.number().int().min(1).max(100).optional(),
      per_page: z.number().int().min(1).max(100).optional(),
    }), "labels");
    return server;
  });
}

export function onRequest({ request, env }) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return new Response(JSON.stringify({ error: "Origin not allowed." }), {
      status: 403,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  return createHandler({ defaultToken: env?.GITHUB_TOKEN || "" }).fetch(request);
}
