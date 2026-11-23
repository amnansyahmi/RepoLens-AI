# RepoLensa roadmap

The goal is **traceable code intelligence**, not just generative repository summaries. This roadmap describes plans, not existing functionality.

## Shipped in v1.1

- Interactive TypeScript/JavaScript dependency graph, basic tsconfig path aliases
- Public GitHub URLs and local folder analysis; bounded, privacy-first processing
- C# project references and approximate namespace relationships
- Structural health radar with source-linked findings and transparent heuristics
- Circular dependency detection; JSON, Mermaid, PNG, SVG and Markdown exports
- Optional in-browser BYOK (Gemini / OpenRouter) and local Ollama

## Next: prioritize accuracy and confidence

- [ ] Run a Roslyn **local helper** for .NET symbols, class dependencies and dependency injection (no false claims of current symbol-level support)
- [ ] Add AST-supported workspace and monorepo resolution for TS/JS
- [ ] Add coverage and complexity integration *only when verifiable inputs exist* — show N/A otherwise
- [ ] Show why any health score changed between two source revisions
- [ ] Expose graph filters, bidirectional source trace and a compact accessible mobile view
- [ ] Add user-owned public GitHub pull-request diff analysis and affected-module estimates
- [ ] Add VS Code extension and opt-in MCP server integration

## Community opportunities

Good first issues should be narrow and testable: improve import parsing fixtures, add useful tooltips, write accessibility tests, or add documentation examples. For larger analyzer changes, open an issue before implementation.

## Design principles

1. **Grounded:** display evidence file paths and state uncertainty.
2. **Private by default:** never upload source from local folders without explicit consent.
3. **Honest scores:** structural heuristics are not security certifications.
4. **Low-cost:** analysis should work without an account, paid API or hosted model.
5. **Contributor friendly:** small PRs with tests and clear reproducible cases.
