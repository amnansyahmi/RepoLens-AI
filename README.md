# RepoLens AI

**See how your codebase connects.** Visualize JavaScript/TypeScript module imports and C# project references as an interactive dependency graph, entirely in your browser.

> **v0.2 MVP:** Lightweight static import and `.csproj` reference exploration. Despite the project name, **AI chat/explanations are not implemented yet**. Full semantic dependency analysis, external imports, TS path aliases, and C# class-level relationships are on the roadmap.

## Features

- Interactive dependency graph with zoom, pan, node selection, and minimap (React Flow)
- Public GitHub URL import — paste `https://github.com/owner/repo` and inspect the default branch, no account or API key
- Local folder selection — no account, token, server, or uploads
- JavaScript/TypeScript relative imports, re-exports, dynamic imports, and CommonJS `require()` scanning
- C# `.csproj` `ProjectReference` visualization
- File explorer, search, source preview, inbound/outbound reference counts
- Directory breakdown, most referenced modules, and JSON export
- Sample project to explore without opening any files
- Mobile responsive layout and a dark dashboard UI

## Quick start

Requires Node.js 20.19+ or 22.12+.

```bash
git clone https://github.com/amnansyahmi/RepoLens-AI.git
cd RepoLens-AI
npm install
npm run dev
```

Open the local address printed by Vite. Paste a public repository URL into **Analyze GitHub repo**, or select **Open local folder** to inspect your own code. Local files never leave your browser. Remote imports retrieve source files from GitHub's public API and `raw.githubusercontent.com` into your browser memory; RepoLens has no application backend and does not collect them. The Google Fonts stylesheet is an optional third-party font request; for completely offline use, replace it with a system font.

```bash
npm test
npm run typecheck
npm run build
```

## Limits and privacy

Local import processes up to **400 supported source files** and **3 MB** in total. Public GitHub import reads up to **120 files**, **3 MB** total, **100 KB** per file, and only the repository's default branch. If GitHub's raw-source host is blocked, the app attempts an API fallback with a tighter **35-file** cap. The importer limits concurrent requests and displays partial-result warnings for skipped/failed files. GitHub's public unauthenticated API is limited to approximately **60 requests/hour per IP**, and very large/truncated repository trees are not supported. No GitHub token is requested. It excludes typical dependency/build directories. Browser folder selection depends on browser support. Analysis is heuristic, not a full parser, so unresolved relative paths, comments, TS aliases, C# class references, transitive dependencies and non-literal imports may be inaccurate or unsupported. File source remains in memory for the browser session; the exported JSON contains file names and graph metadata but not source text. Never paste secrets into GitHub issues.

## Roadmap

1. TypeScript AST parsing, path alias support and better graph layout
2. Roslyn-backed C# namespaces, class references and dependency injection graph
3. Improve public GitHub import: partial repository selection, advanced filtering, and optional authenticated high-quota access
4. Optional opt-in BYOK AI explanations with privacy-first controls
5. SVG/PNG export, architecture documentation, MCP and VS Code integrations

## Contributing

Issues and PRs are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE). Created by Amnansyahmi.
