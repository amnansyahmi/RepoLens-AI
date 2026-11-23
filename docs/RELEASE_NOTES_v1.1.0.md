# RepoLensa AI v1.1.0 — Evidence-based repository intelligence

RepoLensa turns public GitHub repositories or local folders into interactive code architecture graphs and explainable structural reports, without a required account or subscription.

## Highlights

- **Interactive architecture explorer** with JS/TS import relationships, basic TypeScript alias resolution and heuristic C# project/namespace links
- **Evidence-first health report:** cycle, coupling, reference-resolution, file-size and architectural-boundary signals. Every flagged finding includes the observed fact, affected files and a suggested next step
- **Clear visualizations:** dependency graph, health radar, language ring, module explorer and source previews
- **Export and share:** JSON, Mermaid, SVG, PNG and Markdown reports
- **Optional AI:** local Ollama or user-provided Gemini/OpenRouter API key, with consent before cloud requests; cloud AI receives report metadata, not source text
- **Local-first:** no required database, user account, backend service or telemetry SDK

## Get started

**Demo:** https://repolensa-ai.vercel.app

**Repository:** https://github.com/amnansyahmi/RepoLensa-AI

Run locally:

```bash
git clone https://github.com/amnansyahmi/RepoLensa-AI.git
cd RepoLensa-AI
npm install
npm run dev
```

Explore the included ten-file example to try the dependency map without API keys or a GitHub download.

## Compatibility and known limits

- C# using-namespace detection is **heuristic**, not full Roslyn symbol resolution.
- Public GitHub imports are capped at 120 files and 3 MB; large or partial imports can omit edges.
- Health scores are **structural heuristics**, not a security audit or certified maintainability score; unsupported/insufficient data can produce N/A.
- Cloud BYOK can be blocked by browser/provider CORS policies and may incur third-party charges.
- No API keys or source code are included with this release.

## Contributing

See the [contribution guide](https://github.com/amnansyahmi/RepoLensa-AI/blob/main/CONTRIBUTING.md) and [roadmap](https://github.com/amnansyahmi/RepoLensa-AI/blob/main/docs/ROADMAP.md). Please report sensitive vulnerabilities privately.

MIT licensed. © 2026 Amnansyahmi.
