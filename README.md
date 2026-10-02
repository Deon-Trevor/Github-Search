# GitHub Explorer

A GitHub research workspace for profiles, repositories, labels, and global search. The browser app is served as static files; the REST API and MCP endpoint run as Cloudflare Pages Functions.

## Run locally

```bash
npm ci
npm run dev
```

Open `http://127.0.0.1:8788`. Node 20 or newer is required. Run `npm test` for the API and MCP contract checks.

The browser app calls GitHub directly. A token entered in the access menu stays in that tab and is sent only to GitHub. API and MCP callers can send `X-GitHub-Token`; the Function forwards it to GitHub for that request and does not store it.

## REST API

| Route | Result |
| --- | --- |
| `GET /api/v1/health` | Health check |
| `GET /api/v1/users/:login` | Exact profile |
| `GET /api/v1/users/:login/repos` | User repositories |
| `GET /api/v1/repos/:owner/:repo/labels` | Repository labels |
| `GET /api/v1/search?type=&q=` | Global search |

Search types: `repositories`, `users`, `code`, `commits`, `issues`, `topics`. Search accepts `page` (1-10) and `per_page` (1-100). Repository and label lists accept `page` (1-100) and `per_page` (1-100). Defaults are 20 search results, 30 repositories, and 100 labels.

Successful responses keep GitHub's JSON shape. GitHub errors return their status and a JSON `error` message. Rate limit and pagination headers are forwarded. Results are not cached.

```bash
curl 'http://127.0.0.1:8788/api/v1/search?type=repositories&q=language:go&per_page=20'
```

## MCP

Connect a Streamable HTTP MCP client to `http://127.0.0.1:8788/mcp`, or to `https://github.syncpundit.io/mcp` after deployment. The endpoint offers four tools:

- `get_user(login)`
- `list_user_repos(login, page?, per_page?)`
- `search_github(type, q, page?, per_page?)`
- `list_repo_labels(owner, repo, page?, per_page?)`

Each request is stateless. Tool results include GitHub JSON in `structuredContent.result` and as text. Clients that support custom headers can send `X-GitHub-Token` for their own rate limit allowance and authenticated search. The [main page](public/index.html#endpoints) has a short endpoint summary.

## Deploy

The Cloudflare Pages project `github-search` is connected to `Deon-Trevor/Github-Search`. Its production branch is `main`, with automatic deployments enabled. Use **Framework preset** `None`, **Build command** `npm ci`, **Build output directory** `public`, and a blank **Root directory**. The checked-in `wrangler.toml` also names `public` as the static output. Pages must start at the repository root to find `functions/`; `npm ci` installs the dependencies needed to bundle the MCP endpoint.

Push `main` to deploy:

```bash
git push origin main
```

Cloudflare builds and deploys the static site and Pages Functions from that push. Check the deployment status in Cloudflare, then request `https://github.syncpundit.io/api/v1/health` and `https://github.syncpundit.io/mcp`. A local commit alone does not update the live site. Other branches can create preview deployments according to the project's branch controls.

No server process, Docker image, deploy hook, or shared GitHub token is needed for this Pages deployment. GitHub's rate limits still apply to unauthenticated requests.

## Files

- `public/`: browser app and static assets
- `functions/api/[[path]].js`: REST routes
- `functions/mcp.js`: Streamable HTTP MCP endpoint
- `lib/github.js`: shared GitHub request validation and forwarding
- `test/`: API and MCP contract checks
