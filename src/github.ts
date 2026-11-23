import type { SourceFile } from "./analyzer";

export type GitHubRepository = { owner: string; name: string; fullName: string };
export type ImportProgress = { completed: number; total: number; phase: "metadata" | "reading" };
export type GitHubImportResult = {
  files: SourceFile[];
  fullName: string;
  branch: string;
  url: string;
  scanned: number;
  eligible: number;
  skipped: number;
  failed: number;
  partial: boolean;
  usedApiFallback: boolean;
};

type Fetcher = typeof fetch;
type GitHubRepoResponse = { default_branch?: string; private?: boolean; full_name?: string };
type GitHubBranchResponse = { commit?: { sha?: string } };
type GitTreeResponse = { truncated?: boolean; tree?: Array<{ type?: string; path?: string; size?: number; sha?: string }> };
type BlobResponse = { content?: string; encoding?: string; size?: number };

export const MAX_GITHUB_FILES = 120;
export const MAX_GITHUB_BYTES = 3_000_000;
const MAX_FILE_BYTES = 100_000;
const MAX_FALLBACK_FILES = 35;
const GITHUB_API = "https://api.github.com";
const supported = /\.(tsx?|jsx?|mjs|cjs|cs|csproj)$/i;
const ignored = /(^|\/)(node_modules|vendor|dist|build|coverage|\.git|\.next|\.nuxt|\.turbo|bin|obj)(\/|$)/i;

export function parseGitHubRepository(value: string): GitHubRepository {
  const input = value.trim();
  let segments: string[];
  if (/^https?:\/\//i.test(input)) {
    let url: URL;
    try { url = new URL(input); } catch { throw new Error("Enter a valid GitHub repository URL."); }
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com" ||
        url.port || url.username || url.password || url.search || url.hash) {
      throw new Error("Only public https://github.com/owner/repo links are supported.");
    }
    segments = url.pathname.split("/").filter(Boolean);
  } else {
    if (input.includes("://") || input.includes("?") || input.includes("#")) {
      throw new Error("Enter a GitHub repository URL or owner/repo.");
    }
    segments = input.split("/").filter(Boolean);
  }
  if (segments.length !== 2) {
    throw new Error("Use the repository root URL, such as https://github.com/owner/repo.");
  }
  const [owner, originalName] = segments;
  const name = originalName.replace(/\.git$/i, "");
  // Explicit grammar prevents arbitrary host/path requests.
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(owner) ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(name)) {
    throw new Error("The repository owner or name contains unsupported characters.");
  }
  return { owner, name, fullName: owner + "/" + name };
}

export function eligibleGithubFiles(entries: NonNullable<GitTreeResponse["tree"]>) {
  const candidates = entries
    .filter((entry): entry is typeof entry & { path: string; sha: string; size: number } =>
      entry.type === "blob" && typeof entry.path === "string" &&
      typeof entry.sha === "string" && /^[a-f0-9]{40}$/i.test(entry.sha) &&
      typeof entry.size === "number" && Number.isSafeInteger(entry.size) && entry.size >= 0)
    .filter(entry => supported.test(entry.path) && !ignored.test(entry.path) &&
      entry.size <= MAX_FILE_BYTES && !/\.min\.(js|mjs|cjs)$/i.test(entry.path));
  // Prefer source code and .csproj files over samples and tests if the repo is large.
  const priority = (path: string) =>
    (/\.csproj$/i.test(path) ? -100 : 0) +
    (/(^|\/)(src|app|lib|components|features|packages)(\/|$)/i.test(path) ? -20 : 0) +
    (/(^|\/)(__tests__|test|tests|fixtures|examples)(\/|$)/i.test(path) ? 15 : 0);
  return candidates.sort((a, b) => priority(a.path) - priority(b.path) || a.path.localeCompare(b.path));
}

function chooseFiles(entries: ReturnType<typeof eligibleGithubFiles>) {
  const chosen: typeof entries = [];
  let bytes = 0;
  for (const entry of entries) {
    if (chosen.length >= MAX_GITHUB_FILES) break;
    if (bytes + entry.size > MAX_GITHUB_BYTES) continue;
    chosen.push(entry);
    bytes += entry.size;
  }
  return chosen;
}

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function api<T>(url: string, client: Fetcher, signal?: AbortSignal): Promise<T> {
  const response = await client(url, {
    headers: { Accept: "application/vnd.github+json" },
    credentials: "omit",
    signal
  });
  if (!response.ok) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    if ((response.status === 403 || response.status === 429) && remaining === "0") {
      throw new Error("GitHub's public API rate limit was reached (60 unauthenticated requests/hour per IP). Try again later or open a local folder.");
    }
    if (response.status === 404) throw new Error("GitHub repository or revision was not found. Check that it is public.");
    if (response.status === 403 || response.status === 429) throw new Error("GitHub declined the request (rate or abuse protection). Try again later.");
    throw new Error("GitHub API returned HTTP " + response.status + ".");
  }
  return response.json() as Promise<T>;
}

async function rawSource(
  repo: GitHubRepository, commit: string, path: string, client: Fetcher, signal?: AbortSignal
): Promise<string> {
  const response = await client(
    "https://raw.githubusercontent.com/" + repo.fullName + "/" + commit + "/" + encodePath(path),
    { credentials: "omit", signal }
  );
  if (!response.ok) throw new Error("Raw GitHub source HTTP " + response.status + ".");
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_FILE_BYTES) throw new Error("Source file exceeded the allowed size.");
  return text;
}

async function blobSource(
  repo: GitHubRepository, sha: string, client: Fetcher, signal?: AbortSignal
): Promise<string> {
  const blob = await api<BlobResponse>(
    GITHUB_API + "/repos/" + repo.fullName + "/git/blobs/" + sha, client, signal
  );
  if (blob.encoding !== "base64" || typeof blob.content !== "string" || (blob.size || 0) > MAX_FILE_BYTES) {
    throw new Error("GitHub returned an unsupported source encoding or oversized file.");
  }
  const binary = atob(blob.content.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, letter => letter.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export async function importPublicGitHubRepository(
  input: string,
  options: { fetcher?: Fetcher; signal?: AbortSignal; onProgress?: (value: ImportProgress) => void } = {}
): Promise<GitHubImportResult> {
  const repo = parseGitHubRepository(input);
  const client = options.fetcher || fetch;
  const { signal, onProgress } = options;
  onProgress?.({ phase: "metadata", completed: 0, total: 0 });
  const base = GITHUB_API + "/repos/" + repo.fullName;
  const metadata = await api<GitHubRepoResponse>(base, client, signal);
  if (metadata.private || !metadata.default_branch) throw new Error("Only public repositories with a default branch are supported.");
  const branchInfo = await api<GitHubBranchResponse>(
    base + "/branches/" + encodeURIComponent(metadata.default_branch), client, signal
  );
  const commit = branchInfo.commit?.sha;
  if (!commit || !/^[a-f0-9]{40}$/i.test(commit)) throw new Error("GitHub did not return a valid branch revision.");
  const tree = await api<GitTreeResponse>(base + "/git/trees/" + commit + "?recursive=1", client, signal);
  if (tree.truncated) throw new Error("This repository has a truncated GitHub file tree. Try a smaller repository or a local folder.");
  if (!Array.isArray(tree.tree)) throw new Error("GitHub returned an invalid repository tree.");
  const eligible = eligibleGithubFiles(tree.tree);
  if (!eligible.length) throw new Error("No supported TypeScript, JavaScript or C# source files were found.");
  let selected = chooseFiles(eligible);
  if (!selected.length) throw new Error("The supported files exceed the import size limit.");
  let usedApiFallback = false;
  const first = selected[0];
  let firstText: string;
  try {
    firstText = await rawSource(repo, commit, first.path, client, signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    // Raw-file fetches can be blocked by CORS. Use GitHub's documented CORS API
    // and cap blob requests to protect the public unauthenticated API allowance.
    usedApiFallback = true;
    selected = selected.slice(0, MAX_FALLBACK_FILES);
    firstText = await blobSource(repo, first.sha, client, signal);
  }
  const results: Array<SourceFile | undefined> = new Array(selected.length);
  results[0] = { path: first.path, content: firstText };
  let done = 1;
  let failed = 0;
  onProgress?.({ phase: "reading", completed: done, total: selected.length });
  let nextIndex = 1;
  const readOne = async (index: number) => {
    const entry = selected[index];
    try {
      const text = usedApiFallback
        ? await blobSource(repo, entry.sha, client, signal)
        : await rawSource(repo, commit, entry.path, client, signal);
      results[index] = { path: entry.path, content: text };
    } catch (error) {
      if (signal?.aborted) throw error;
      failed++;
    } finally {
      done++;
      onProgress?.({ phase: "reading", completed: done, total: selected.length });
    }
  };
  const worker = async () => {
    while (nextIndex < selected.length) {
      if (signal?.aborted) throw new DOMException("Import cancelled", "AbortError");
      const index = nextIndex++;
      await readOne(index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(usedApiFallback ? 2 : 4, Math.max(0, selected.length - 1)) }, worker));
  const files = results.filter((entry): entry is SourceFile => entry !== undefined);
  if (!files.length) throw new Error("GitHub source files could not be downloaded.");
  return {
    files,
    fullName: repo.fullName,
    branch: metadata.default_branch,
    url: "https://github.com/" + repo.fullName,
    scanned: tree.tree.length,
    eligible: eligible.length,
    skipped: Math.max(0, eligible.length - selected.length),
    failed,
    partial: eligible.length > selected.length || failed > 0,
    usedApiFallback
  };
}
