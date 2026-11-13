import test from "node:test";
import assert from "node:assert/strict";
import { filterRepos } from "../public/assets/repo-filters.js";

const repos = [
  { name: "alpha", language: "Go", stargazers_count: 5, updated_at: "2026-01-03", fork: false, archived: false },
  { name: "beta-fork", language: "JavaScript", stargazers_count: 50, updated_at: "2026-01-05", fork: true, archived: false },
  { name: "gamma-old", description: "legacy tool", language: "Go", stargazers_count: 1, updated_at: "2026-01-01", fork: false, archived: true },
  { name: "delta", language: null, stargazers_count: 0, updated_at: "2026-01-04", fork: true, archived: true },
];
const names = list => list.map(repo => repo.name);

test("filterRepos keeps every repo by default, sorted by last update", () => {
  assert.deepEqual(names(filterRepos(repos)), ["beta-fork", "delta", "alpha", "gamma-old"]);
});

test("filterRepos hides forks and archived repos independently and together", () => {
  assert.deepEqual(names(filterRepos(repos, { hideForks: true })), ["alpha", "gamma-old"]);
  assert.deepEqual(names(filterRepos(repos, { hideArchived: true })), ["beta-fork", "alpha"]);
  assert.deepEqual(names(filterRepos(repos, { hideForks: true, hideArchived: true })), ["alpha"]);
});

test("filterRepos combines toggles with the text filter and sort", () => {
  assert.deepEqual(names(filterRepos(repos, { query: " GO ", sort: "stars" })), ["alpha", "gamma-old"]);
  assert.deepEqual(names(filterRepos(repos, { query: "legacy", hideArchived: true })), []);
  assert.deepEqual(names(filterRepos(repos, { sort: "name", hideForks: true })), ["alpha", "gamma-old"]);
});

test("filterRepos does not mutate its input", () => {
  const before = names(repos);
  filterRepos(repos, { sort: "name", hideForks: true });
  assert.deepEqual(names(repos), before);
});
