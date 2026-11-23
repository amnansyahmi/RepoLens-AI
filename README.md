# RepoLens AI

**See how your codebase connects.** Visualize JavaScript/TypeScript module imports and C# project references as an interactive dependency graph, entirely in your browser.

> **v0.1 MVP:** Lightweight static import and `.csproj` reference exploration. Despite the project name, **AI chat/explanations are not implemented yet**. Full semantic dependency analysis, external imports, TS path aliases, and C# class-level relationships are on the roadmap.

## Features

- Interactive dependency graph with zoom, pan, node selection, and minimap (React Flow)
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

Open the local address printed by Vite. Select **Open local folder** and choose a project directory. The browser reads the files locally. No source content is sent to RepoLens servers (there are none). The Google Fonts stylesheet is an optional third-party font request; for completely offline use, replace it with a system font.

```bash
npm test
npm run typecheck
npm run build
```

## Limits and privacy

The MVP processes up to **400 supported source files** and **3 MB** in total. It excludes typical dependency/build directories. Browser folder selection depends on browser support. Analysis is heuristic, not a full parser, so unresolved relative paths, comments, TS aliases, C# class references, transitive dependencies and non-literal imports may be inaccurate or unsupported. File source remains in memory for the browser session; the exported JSON contains file names and graph metadata but not source text. Never paste secrets into GitHub issues.

## Roadmap

1. TypeScript AST parsing, path alias support and better graph layout
2. Roslyn-backed C# namespaces, class references and dependency injection graph
3. GitHub public repository URL import (safe rate-limited provider access)
4. Optional opt-in BYOK AI explanations with privacy-first controls
5. SVG/PNG export, architecture documentation, MCP and VS Code integrations

## Contributing

Issues and PRs are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE). Created by Amnansyahmi.
