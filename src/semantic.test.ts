import { describe, expect, it } from "vitest";
import { analyzeSemantically } from "./semantic";

describe("compiler-based JS/TS analysis", () => {
  it("ignores imports in comments and strings, but follows dynamic/require/re-export imports", () => {
    const result = analyzeSemantically([
      {path:"src/a.ts",content:"// import './ghost';\nconst quoted = \"import './ghost'\";\nimport './b';\nexport * from './c';\nconst d = import('./d');\nconst e = require('./e');"},
      {path:"src/b.ts",content:"export const b = 1;"},
      {path:"src/c.ts",content:"export const c = 1;"},
      {path:"src/d.ts",content:"export const d = 1;"},
      {path:"src/e.ts",content:"export const e = 1;"}
    ]);
    expect(result.edges.map(e=>e.target).sort()).toEqual(["src/b.ts","src/c.ts","src/d.ts","src/e.ts"]);
    expect(result.unresolved).toBe(0);
  });
  it("resolves tsconfig paths and baseUrl aliases", () => {
    const result = analyzeSemantically([
      {path:"repo/tsconfig.json",content:JSON.stringify({compilerOptions:{baseUrl:".",paths:{"@/*":["src/*"]}}})},
      {path:"repo/src/main.ts",content:"import { run } from '@/helpers/run';\nimport 'src/config';"},
      {path:"repo/src/helpers/run.ts",content:"export const run = 1;"},
      {path:"repo/src/config.ts",content:"export default {};"}
    ]);
    expect(result.edges.map(e=>e.target).sort()).toEqual(["repo/src/config.ts","repo/src/helpers/run.ts"]);
  });
  it("detects internal C# using namespace relations and project references", () => {
    const result = analyzeSemantically([
      {path:"src/App/App.csproj",content:'<Project><ItemGroup><ProjectReference Include="..\\Shared\\Shared.csproj" /></ItemGroup></Project>'},
      {path:"src/Shared/Shared.csproj",content:"<Project/>"},
      {path:"src/App/Startup.cs",content:"using Company.Shared;\nusing System;\nnamespace Company.App;"},
      {path:"src/Shared/Thing.cs",content:"namespace Company.Shared;\npublic class Thing {}"}
    ]);
    expect(result.edges).toContainEqual({source:"src/App/App.csproj",target:"src/Shared/Shared.csproj",kind:"project"});
    expect(result.edges).toContainEqual({source:"src/App/Startup.cs",target:"src/Shared/Thing.cs",kind:"namespace"});
  });
  it("keeps missing relative imports visible as unresolved", () => {
    const result=analyzeSemantically([{path:"src/a.ts",content:"import './missing';"}]);
    expect(result.unresolved).toBe(1);
  });
});
