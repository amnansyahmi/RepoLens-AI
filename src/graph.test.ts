import { describe, expect, it } from "vitest";
import { analyze } from "./analyzer";
import { architectureInsights, layoutGraph, projectGraph } from "./graph";
describe("architecture graph", () => {
  const analysis = analyze([
    { path:"src/ui/app.ts", content:"import '../core/api';" },
    { path:"src/core/api.ts", content:"import './shared';" },
    { path:"src/core/shared.ts", content:"" },
    { path:"src/alone.ts", content:"" }
  ]);
  it("rolls files into directory groups and only preserves cross-directory edges", () => {
    const grouped = projectGraph(analysis, "directories");
    expect(grouped.nodes.map(n => n.id)).toContain("dir:src/core");
    expect(grouped.edges).toEqual([{ source:"dir:src/ui", target:"dir:src/core", kind:"import" }]);
  });
  it("lays out all nodes in either direction", () => {
    for (const direction of ["LR", "TB"] as const) {
      const positions = layoutGraph(analysis.nodes, analysis.edges, direction);
      expect(positions).toHaveLength(4);
      expect(new Set(positions.map(p => p.id)).size).toBe(4);
    }
  });
  it("finds hubs and isolated nodes", () => {
    const insights = architectureInsights(analysis);
    expect(insights.isolated).toContain("src/alone.ts");
    expect(insights.hubs[0].id).toBe("src/core/api.ts");
  });
  it("detects real multi-node cycles", () => {
    const cyclic = analyze([
      {path:"a.ts",content:"import './b';"},
      {path:"b.ts",content:"import './c';"},
      {path:"c.ts",content:"import './a';"}
    ]);
    expect(architectureInsights(cyclic).cycles).toEqual([["a.ts","b.ts","c.ts"]]);
  });
});
