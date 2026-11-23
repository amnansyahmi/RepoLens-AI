import { describe, expect, it } from "vitest";
import { analyze, summarize } from "./analyzer";
describe("analyze", () => {
  it("resolves relative imports and index modules", () => {
    const result = analyze([
      { path: "src/main.ts", content: "import { x } from './lib';\nimport './style.css';" },
      { path: "src/lib/index.ts", content: "export const x = 1;" }
    ]);
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toEqual([{ source: "src/main.ts", target: "src/lib/index.ts", kind: "import" }]);
    expect(result.unresolved).toBe(1);
  });
  it("deduplicates edges and ignores external packages", () => {
    const result = analyze([
      { path: "a.ts", content: "import './b'; import './b'; import React from 'react';" },
      { path: "b.ts", content: "export default 1" }
    ]);
    expect(result.edges).toHaveLength(1);
    expect(result.unresolved).toBe(0);
  });
  it("resolves C# project references using Windows paths", () => {
    const result = analyze([
      { path: "src/App/App.csproj", content: '<Project><ItemGroup><ProjectReference Include="..\\Shared\\Shared.csproj" /></ItemGroup></Project>' },
      { path: "src/Shared/Shared.csproj", content: "<Project />" }
    ]);
    expect(result.edges).toEqual([{ source: "src/App/App.csproj", target: "src/Shared/Shared.csproj", kind: "project" }]);
  });
  it("excludes dependency and build folders", () => {
    const result = analyze([{ path: "node_modules/a.ts", content: "" }, { path: "bin/a.cs", content: "" }, { path: "src/a.cs", content: "" }]);
    expect(result.nodes.map(node => node.id)).toEqual(["src/a.cs"]);
    expect(summarize(result).directories).toEqual([["src", 1]]);
  });
});
