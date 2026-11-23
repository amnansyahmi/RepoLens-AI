<div align="center">

# 🔍 RepoLens AI

**Understand any codebase without reading every file.**

A free, open-source, browser-first architecture explorer. Paste a public GitHub URL or open a local folder to generate interactive dependency graphs, inspect architecture hotspots, find cycles, and export diagrams.

[Features](#features) · [Quick start](#quick-start) · [Supported analysis](#supported-analysis) · [Local AI](#optional-local-ai-with-ollama) · [Privacy](#privacy--limits) · [Contributing](CONTRIBUTING.md)

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Stack](https://img.shields.io/badge/stack-React%20%2B%20TypeScript-5f7db6)

</div>

## Why RepoLens?

Repositories are easier to understand when you can **see the relationships** between modules and projects. RepoLens helps developers, reviewers, students, and maintainers navigate an unfamiliar codebase without requiring a paid SaaS subscription or uploading private code to an analysis service.

## Features

| Capability | What's included |
|---|---|
| **GitHub import** | Enter a public `https://github.com/owner/repo` URL; download capped source files directly from GitHub APIs |
| **Private local analysis** | Select a directory on your own device; no application backend or source uploads |
| **JS/TS semantic imports** | TypeScript compiler syntax-tree parsing: imports, re-exports, `require()`, dynamic `import()`, basic tsconfig/jsconfig paths |
| **.NET relationships** | C# `.csproj` project references and approximate `using`-namespace relationships |
| **Interactive graph** | Search, pan, zoom, minimap, file details and source preview |
| **Architecture views** | File or directory nodes; left-to-right or top-to-bottom layout |
| **Insights** | Circular dependencies, isolated files, likely entrypoints, highly referenced modules and language distribution |
| **Export** | JSON, Mermaid (`.mmd`), SVG and PNG architecture diagrams |
| **Optional local AI** | Explicitly ask a locally running Ollama model to explain graph metadata and suggest improvements; no cloud API key |
| **Open source** | MIT license, no login, CI-verified tests and production build |

## Quick start

Prerequisites: **Node.js 20.19+ or 22.12+** and npm.

```bash
git clone https://github.com/amnansyahmi/RepoLens-AI.git
cd RepoLens-AI
npm install
npm run dev
```

Open the local URL printed by Vite. Try the example project immediately, choose **Open local folder**, or paste a public GitHub URL such as:

```text
https://github.com/amnansyahmi/RepoLens-AI
```

Explore **Files / Directories**, switch the graph direction, select nodes to view detail, and choose **Export graph** to save SVG, PNG, JSON or Mermaid.

For a production build:

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

## Supported analysis

**JavaScript / TypeScript**: `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`. Local and remote `tsconfig.json` / `jsconfig.json` are read for basic paths and `baseUrl` resolution. The TypeScript compiler parses syntax without executing repository code.

**C# / .NET**: `.cs` files and `.csproj` projects. The graph visualizes direct project references and approximate relationships through namespace declarations and `using` directives.

**Important limits:** this is a *static architectural guide*, not a build or a security scanner. C# type-level/DI relationships need a Roslyn-based analyzer and are **not** represented as verified symbols. JS/TS package imports, advanced tsconfig inheritance, conditional resolution, runtime code paths and nonliteral module paths may be omitted. Regex-based .NET namespace extraction can miss or misidentify dependencies. Partial GitHub imports can leave missing links.

The analyzer never executes imported repository code.

## Optional local AI with Ollama

AI explanations are **optional**; the rest of RepoLens works without any model. Install [Ollama](https://ollama.com), pull a model, and start the service:

```bash
ollama pull llama3.2
ollama serve
```

If Ollama is already running, don't start a duplicate service.

Open **Explain architecture with local AI** in RepoLens, enter your installed model name, and click **Explain**. The browser sends **graph metadata only** (file paths, language types, dependency edges and metrics) to `http://127.0.0.1:11434/api/chat` — **not source text** — only when you click the button. No default third-party AI provider or API key is used.

To permit browser connections, Ollama may require `OLLAMA_ORIGINS` to include your RepoLens site's exact origin. Example local-development configuration (set before starting Ollama):

```bash
# macOS / Linux
OLLAMA_ORIGINS=http://localhost:5173 ollama serve
```

On Windows, configure the Ollama environment variable and restart Ollama. If the site is hosted over HTTPS, browser security rules can restrict requests to a local HTTP service. In that case, run RepoLens locally or use a compatible secure local setup. **Never expose Ollama's port publicly** just to make the feature work.

Explanations may be incorrect; verify all suggestions against actual source code.

## Privacy & limits

- **Local folder analysis** stays in browser memory. RepoLens has no code-upload endpoint, user database, analytics SDK, account requirement or hosted model. Google Fonts may make a separate external font request; no source content is included in it.
- **GitHub import** requests public metadata and source files directly from `api.github.com` and `raw.githubusercontent.com`. Your browser contacts GitHub as expected. GitHub's unauthenticated rate limit is commonly **60 REST API requests per IP/hour**.
- **GitHub import caps:** up to **120 files**, **3 MB** total and **100 KB per file**; fallback to the blob API caps files at **35**. Large/truncated trees are rejected with an explanation. Partial imports are clearly flagged.
- **Local import caps:** up to **400 supported/config files** and **3 MB**. Your folder picker may include unsupported content, which is ignored.
- The app does **not** run source code, request GitHub credentials, or fetch arbitrary domains from pasted repository URLs.
- **Exports** contain filenames, graph relationships and summary metadata, not source code. Take care: file paths can still reveal private project structure.
- Ollama requests contain graph metadata, which may be sensitive even without source code. This feature is opt-in and only points to the local loopback host.

## Deployment

RepoLens is a static Vite application. Deploy it from this repository using **Vercel** (Framework: Vite, Build: `npm run build`, Output: `dist`) or host the contents of `dist/` on any static provider. No hosted API service or database is required.

A local build also works completely offline for local folder browsing after its assets are loaded; hosted GitHub imports require GitHub connectivity.

## Roadmap beyond v1

- More accurate Roslyn-powered C# symbols, services and dependency-injection visualization
- Incremental processing and larger repository handling
- More advanced workspace/monorepo resolution and graph clustering
- VS Code extension, MCP server and offline-first PWA

If you want to contribute, see [CONTRIBUTING.md](CONTRIBUTING.md). For security issues, see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 Amnansyahmi.
