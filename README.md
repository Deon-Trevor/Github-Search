# GitHub Explorer

A GitHub research workspace for profiles, repositories, labels, and global search. The browser app is served as static files; the REST API and MCP endpoint run as Cloudflare Pages Functions.

## Run locally

```bash
npm ci
npm run dev
```

Open `http://127.0.0.1:8788`. Node 20 or newer is required. Run `npm test` for the API and MCP contract checks.

Without a personal token, the browser app calls the site's REST API. If `GITHUB_TOKEN` is set on Cloudflare, the Function uses it for GitHub requests. A token entered in the browser stays in that tab and is sent directly to GitHub. Use **Verify with GitHub** to confirm it works and see which account it belongs to. API and MCP callers can send `X-GitHub-Token` to use their own token for a request instead of the site default.

## REST API

| Route | Result |
| --- | --- |
| `GET /api/v1/health` | Health check |
| `GET /api/v1/users/:login` | Exact profile |
| `GET /api/v1/users/:login/repos` | User repositories |
| `GET /api/v1/orgs/:login/repos` | Public organization repositories |
| `GET /api/v1/repos/:owner/:repo/labels` | Repository labels |
| `GET /api/v1/search?type=&q=` | Global search |

Search types: `repositories`, `users`, `code`, `commits`, `issues`, `topics`. Search accepts `sort`, `order` (`asc` or `desc`), `page` (1-10), and `per_page` (1-100). For example, `type=users&sort=joined&order=desc` lists recently joined accounts first. Code and commit searches request GitHub's text-match metadata. User and organization repository lists accept `sort` (`created`, `updated`, `pushed`, `full_name`), `direction` (`asc` or `desc`), `page` (1-100), and `per_page` (1-100). Repository sorting defaults to `updated`; set `sort=pushed` for recent pushes. Label lists accept `page` and `per_page`. Defaults are 20 search results, 30 repositories, and 100 labels.

Successful responses keep GitHub's JSON shape. GitHub errors return their status and a JSON `error` message. The proxy forwards GitHub's `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-used`, `x-ratelimit-reset`, `x-ratelimit-resource`, `retry-after`, and `link` headers when present, including on errors. Browser clients can read these headers across origins. Results are not cached.

```bash
curl 'http://127.0.0.1:8788/api/v1/search?type=repositories&q=language:go&per_page=20'
```

## MCP

Connect a Streamable HTTP MCP client to `http://127.0.0.1:8788/mcp`, or to `https://github.syncpundit.io/mcp` after deployment. The endpoint offers four tools:

- `get_user(login)`
- `list_user_repos(login, page?, per_page?)`
- `list_org_repos(login, page?, per_page?, sort?, direction?)`
- `search_github(type, q, page?, per_page?)`
- `list_repo_labels(owner, repo, page?, per_page?)`

`list_user_repos` also accepts `sort` and `direction`; `search_github` also accepts `sort` and `order`. Each request is stateless. Tool results include GitHub JSON in `structuredContent.result` and as text. Clients that support custom headers can send `X-GitHub-Token` for their own rate limit allowance and authenticated search. The [main page](public/index.html#endpoints) has a short endpoint summary.

## Optional site token

In Cloudflare, open **Workers & Pages > github-search > Settings > Variables and Secrets > Add**. Create `GITHUB_TOKEN` as an encrypted **Secret** for Production. Deploy again after saving it. Set a separate Preview secret if previews need it. For local development, place `GITHUB_TOKEN="..."` in an untracked `.dev.vars` beside `wrangler.toml`; `.gitignore` excludes it.

This token is used by public REST, MCP, and browser requests when the caller has no token. Anyone can spend its shared GitHub rate limit. Use a dedicated, read-only token with no access to private repositories or other sensitive data. Never use a token that can read private code here. A caller's `X-GitHub-Token` header takes precedence; a browser personal token goes directly to GitHub and is never sent to this site.

## Deploy

The Cloudflare Pages project `github-search` is connected to `Deon-Trevor/Github-Search`. Its production branch is `main`, with automatic deployments enabled. Use **Framework preset** `None`, **Build command** `npm ci`, **Build output directory** `public`, and a blank **Root directory**. The checked-in `wrangler.toml` also names `public` as the static output. Pages must start at the repository root to find `functions/`; `npm ci` installs the dependencies needed to bundle the MCP endpoint.

Push `main` to deploy:

```bash
git push origin main
```

Cloudflare builds and deploys the static site and Pages Functions from that push. Check the deployment status in Cloudflare, then request `https://github.syncpundit.io/api/v1/health` and `https://github.syncpundit.io/mcp`. A local commit alone does not update the live site. Other branches can create preview deployments according to the project's branch controls.

No server process, Docker image, or deploy hook is needed for this Pages deployment. Without `GITHUB_TOKEN` or a caller token, GitHub's unauthenticated rate limits apply.

## Files

- `public/`: browser app and static assets
- `functions/api/[[path]].js`: REST routes
- `functions/mcp.js`: Streamable HTTP MCP endpoint
- `lib/github.js`: shared GitHub request validation and forwarding
- `test/`: API and MCP contract checks
