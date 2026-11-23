import { describe, expect, it } from "vitest";
import { analyze } from "./analyzer";
import { buildEngineeringReport, reportToMarkdown } from "./health";

describe("evidence-based structural report", () => {
  it("flags real cycles with file paths, and keeps the score documented as a heuristic", () => {
    const analysis=analyze([
      {path:"src/a.ts",content:"import './b';"},
      {path:"src/b.ts",content:"import './c';"},
      {path:"src/c.ts",content:"import './a';"}
    ]);
    const report=buildEngineeringReport(analysis,{source:"acme/repo"});
    expect(report.overall).not.toBe(null);
    const finding=report.findings.find(f=>f.id.startsWith("cycle-"));
    expect(finding?.severity).toBe("high");
    expect(finding?.evidence).toEqual(["src/a.ts","src/b.ts","src/c.ts"]);
    expect(report.dimensions.find(d=>d.id==="cycles")?.score).toBe(80);
    const md=reportToMarkdown(report);
    expect(md).toContain("src/a.ts");
    expect(md).toContain("not a security audit");
    expect(md).toContain("acme/repo");
  });
  it("does not claim a perfect score when no dependency evidence is available", () => {
    const report=buildEngineeringReport({nodes:[],edges:[],unresolved:0});
    expect(report.overall).toBe(null);
    expect(report.dimensions.every(d=>d.score===null)).toBe(true);
    expect(report.findings).toEqual([]);
  });
  it("marks partial import and unresolved dependencies clearly",()=>{
    const report=buildEngineeringReport(analyze([
      {path:"src/app.ts",content:"import './missing';"},
      {path:"src/component.ts",content:"export default 1;"}
    ]),{partial:true});
    expect(report.partial).toBe(true);
    expect(report.findings.map(f=>f.id)).toContain("partial");
    expect(report.findings.map(f=>f.id)).toContain("unresolved");
    expect(report.caveats.join(" ")).toMatch(/incomplete repository sample/);
  });
  it("flags large modules and fan-out with evidence",()=>{
    const long="export const value = 1;\n".repeat(340);
    const report=buildEngineeringReport(analyze([
      {path:"src/big.ts",content:long},
      {path:"src/use.ts",content:"import './big';"}
    ]));
    const size=report.findings.find(f=>f.id==="size:src/big.ts");
    expect(size?.fact).toMatch(/lines/);
    expect(size?.evidence).toEqual(["src/big.ts"]);
  });
});
