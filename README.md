# GitHub Explorer

A browser-based GitHub investigation console for quickly pivoting between identities, profiles, repositories, labels, and global GitHub search results.

<p align="center">
  <a href="https://github.com/Deon-Trevor/Github-Search">
    <img alt="GitHub Explorer repository stats" src="https://github-readme-stats.vercel.app/api/pin/?username=Deon-Trevor&repo=Github-Search&theme=github_dark&hide_border=true&title_color=39d5e8&icon_color=f7b84b&text_color=e7edf5&bg_color=06080c" />
  </a>
</p>

<p align="center">
  <img alt="Static frontend" src="https://img.shields.io/badge/runtime-static_frontend-39d5e8?style=for-the-badge&labelColor=06080c" />
  <img alt="GitHub REST API" src="https://img.shields.io/badge/API-GitHub_REST-f7b84b?style=for-the-badge&labelColor=06080c" />
  <img alt="Local token only" src="https://img.shields.io/badge/auth-local_session_only-5ee6a8?style=for-the-badge&labelColor=06080c" />
  <img alt="No backend" src="https://img.shields.io/badge/backend-none-97a5b5?style=for-the-badge&labelColor=06080c" />
</p>

## What it does

- Scan an exact GitHub username and review profile + repository metadata.
- Search for users by real name, alias, or login fragment, then pivot into a profile scan.
- Run global GitHub searches across repositories, users, code, commits, issues/PRs, and topics.
- Inspect repository labels from profile and repository search results.
- Copy deep links for profile/global searches.
- Export scanned profile repositories as JSON or CSV.
- Optionally add a GitHub token in the local UI for higher API limits or authenticated endpoints.

## Privacy model

The app is static and runs in the browser. It does not store data on a backend. The optional GitHub token is read from the local input field and used only for requests made by the current browser session.

## Run locally

From the repository root:

```bash
python3 -m http.server 7777
```

Then open:

```text
http://[::1]:7777
```

A local server is required because the app uses ES modules from `assets/`.

## Project structure

```text
index.html          Main application shell
assets/app.js      Entry point
assets/api.js      GitHub API wrapper
assets/dom.js      DOM lookup helpers
assets/events.js   UI controller and interaction handling
assets/render.js   Safe DOM rendering helpers
assets/state.js    Shared app state and query presets
assets/styles.css  Threat-intel console visual system
assets/utils.js    Small shared utilities
```

## Notes

This is a frontend-only tool. GitHub API rate limits still apply, especially without a token. Some GitHub search endpoints may require authentication or narrower queries.
