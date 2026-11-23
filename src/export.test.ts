import { describe, expect, it } from "vitest";
import { toMermaid, toSvg } from "./export";
import type { Analysis } from "./analyzer";
const graph: Analysis = {
  nodes: [
    {id:"a.ts",label:'<img onerror="x">',directory:"src",extension:"ts",lines:2,external:false},
    {id:"b.ts",label:"b.ts",directory:"src",extension:"ts",lines:3,external:false}
  ],
  edges:[{source:"a.ts",target:"b.ts",kind:"import"}], unresolved:0
};
describe("architecture exports",()=>{
  it("outputs well-formed Mermaid node identifiers",()=>{
    const text=toMermaid(graph);
    expect(text).toContain("flowchart LR");
    expect(text).toContain("n0 --> n1");
    expect(text).toContain('n0["<img onerror=\\"x\\">"]');
  });
  it("escapes user-controlled labels in SVG",()=>{
    const svg=toSvg(graph);
    expect(svg).toContain("&lt;img onerror=&quot;x&quot;&gt;");
    expect(svg).not.toContain('<img onerror="x">');
    expect(svg).toContain("<svg ");
  });
});
