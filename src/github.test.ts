import { describe, expect, it, vi } from "vitest";
import { eligibleGithubFiles, importPublicGitHubRepository, parseGitHubRepository } from "./github";

const commit = "a".repeat(40);
const treeSha = "d".repeat(40);
const blobs = ["b".repeat(40), "c".repeat(40)];
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } });

describe("parseGitHubRepository", () => {
  it("accepts HTTPS GitHub URLs and owner/repo", () => {
    expect(parseGitHubRepository("https://github.com/amnansyahmi/RepoLens-AI/").fullName).toBe("amnansyahmi/RepoLens-AI");
    expect(parseGitHubRepository("amnansyahmi/RepoLens-AI.git").name).toBe("RepoLens-AI");
  });
  it.each([
    "https://github.com.evil.test/owner/repo",
    "http://github.com/owner/repo",
    "https://github.com/owner/repo/tree/main",
    "https://github.com/owner/repo?token=secret",
    "https://name:password@github.com/owner/repo",
    "https://github.com/owner/%2Fetc",
    "owner/../repo",
    "https://raw.githubusercontent.com/owner/repo"
  ])("rejects unsafe or unsupported URL %s", input => {
    expect(() => parseGitHubRepository(input)).toThrow();
  });
});

describe("eligibleGithubFiles", () => {
  it("only includes bounded supported source files", () => {
    const files = eligibleGithubFiles([
      { type: "blob", path: "node_modules/a.ts", sha: commit, size: 3 },
      { type: "blob", path: "src/app.ts", sha: commit, size: 6 },
      { type: "blob", path: "src/large.ts", sha: commit, size: 200_000 },
      { type: "blob", path: "src/a.min.js", sha: commit, size: 4 },
      { type: "blob", path: "src/ignored.png", sha: commit, size: 6 },
      { type: "tree", path: "src/nested.ts", sha: commit, size: 6 },
      { type: "blob", path: "backend/App.csproj", sha: commit, size: 6 }
    ]);
    expect(files.map(file => file.path)).toEqual(["backend/App.csproj", "src/app.ts"]);
  });
});

describe("importPublicGitHubRepository", () => {
  it("loads a commit-pinned GitHub tree and source without credentials", async () => {
    const requested: string[] = [];
    const mockFetch = vi.fn(async (url: RequestInfo | URL) => {
      const path = String(url);
      requested.push(path);
      if (path === "https://api.github.com/repos/owner/repo") return json({ private: false, default_branch: "main" });
      if (path.endsWith("/branches/main")) return json({ commit: { sha: commit } });
      if (path.includes("/git/commits/")) return json({ tree: { sha: treeSha } });
      if (path.includes("/git/trees/")) return json({ truncated: false, tree: [
        { type: "blob", path: "src/main.ts", size: 20, sha: blobs[0] },
        { type: "blob", path: "src/lib.ts", size: 20, sha: blobs[1] }
      ] });
      if (path.endsWith("/src/main.ts")) return new Response("import './lib';", { status: 200 });
      if (path.endsWith("/src/lib.ts")) return new Response("export const x = 1;", { status: 200 });
      throw new Error("Unexpected URL: " + path);
    }) as typeof fetch;
    const progress: string[] = [];
    const result = await importPublicGitHubRepository("https://github.com/owner/repo", {
      fetcher: mockFetch,
      onProgress: value => progress.push(value.phase + ":" + value.completed)
    });
    expect(result.files.map(file => file.path)).toEqual(["src/lib.ts", "src/main.ts"]);
    expect(result.partial).toBe(false);
    expect(result.usedApiFallback).toBe(false);
    expect(requested.some(path => path.includes("/git/trees/" + treeSha))).toBe(true);
    expect(requested.every(path => path.startsWith("https://api.github.com/") || path.startsWith("https://raw.githubusercontent.com/"))).toBe(true);
    expect(progress).toContain("reading:2");
  });
  it("falls back to bounded GitHub blob API when raw downloads fail", async () => {
    const mockFetch = vi.fn(async (url: RequestInfo | URL) => {
      const path = String(url);
      if (path.endsWith("/repos/owner/repo")) return json({ default_branch: "main" });
      if (path.endsWith("/branches/main")) return json({ commit: { sha: commit } });
      if (path.includes("/git/commits/")) return json({ tree: { sha: treeSha } });
      if (path.includes("/git/trees/")) return json({ tree: [{ type: "blob", path: "src/a.ts", sha: blobs[0], size: 7 }] });
      if (path.startsWith("https://raw.githubusercontent.com/")) throw new TypeError("CORS network failure");
      if (path.includes("/git/blobs/")) return json({ encoding: "base64", size: 7, content: btoa("export;") });
      throw new Error("Unexpected URL: " + path);
    }) as typeof fetch;
    const result = await importPublicGitHubRepository("owner/repo", { fetcher: mockFetch });
    expect(result.usedApiFallback).toBe(true);
    expect(result.files).toEqual([{ path: "src/a.ts", content: "export;" }]);
  });
  it("reports GitHub rate limits clearly", async () => {
    const mockFetch = vi.fn(async () => json({ message: "API rate limit exceeded" }, 403, { "x-ratelimit-remaining": "0" })) as typeof fetch;
    await expect(importPublicGitHubRepository("owner/repo", { fetcher: mockFetch }))
      .rejects.toThrow(/rate limit/);
  });
  it("rejects truncated trees rather than making a misleading graph", async () => {
    const mockFetch = vi.fn(async (url: RequestInfo | URL) => {
      const path = String(url);
      if (path.endsWith("/repos/owner/repo")) return json({ default_branch: "main" });
      if (path.endsWith("/branches/main")) return json({ commit: { sha: commit } });
      if (path.includes("/git/commits/")) return json({ tree: { sha: treeSha } });
      return json({ truncated: true, tree: [] });
    }) as typeof fetch;
    await expect(importPublicGitHubRepository("owner/repo", { fetcher: mockFetch }))
      .rejects.toThrow(/truncated/);
  });
});
