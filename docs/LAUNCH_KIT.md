# RepoLensa — community launch kit

Use these messages after checking the demo and reviewing the product screenshots. The goal is constructive feedback, not misleading star solicitation or spam.

## Short description

**RepoLensa** is a free, open-source browser-first tool that maps JavaScript/TypeScript imports, basic .NET project relationships and architecture health signals. Paste a public GitHub repo or select a local folder; get a dependency graph, explainable findings linked to files, and exportable diagrams. Cloud AI is optional BYOK.

**Demo:** https://repolensa-ai.vercel.app

**Source:** https://github.com/amnansyahmi/RepoLensa-AI

## Suggested GitHub README tag line

See the code. Understand the system.

## Reddit / dev community post (copy and customize)

**Title:** I built an open-source tool that maps repository dependencies and highlights architecture risks (no signup required)

**Body:**

I released RepoLensa, an open-source tool that lets you paste a public GitHub URL or analyze a local folder, then explore a dependency graph instead of reading every file blindly.

It currently parses JavaScript/TypeScript import relationships, recognizes basic C# project references and namespace patterns, and flags detectable architecture signals such as dependency cycles, highly referenced modules and unresolved paths. Each finding links to the files behind it, and health scores show their methodology rather than pretending to measure overall code quality.

There's no account or required API key. Gemini/OpenRouter BYOK or local Ollama can optionally explain the findings, but the graph/report work without AI.

The tool is still limited on large GitHub imports and doesn't offer Roslyn-level C# symbol analysis yet. I'd especially appreciate feedback on useful filters, scoring clarity and .NET analysis.

Try it: https://repolensa-ai.vercel.app

Code (MIT): https://github.com/amnansyahmi/RepoLensa-AI

## Hacker News title options

- Show HN: RepoLensa – Browser-first code dependency maps with evidence-backed architecture reports
- Show HN: Open-source repository visualizer with local analysis and optional BYOK AI

Avoid claiming feature parity with paid tools, claiming all analysis is perfect, or promising that public GitHub API access is unlimited.

## Where to share thoughtfully

- GitHub profile pin and professional portfolio homepage
- Targeted discussions about dependency graphs, React Flow, TypeScript, .NET modernization or code review
- Relevant community showcases and Show HN when the demo is polished
- Friends or collaborators who can provide reproducible bug reports

Respond to useful issues and ship improvements; meaningful adoption matters more than vanity star counts.
