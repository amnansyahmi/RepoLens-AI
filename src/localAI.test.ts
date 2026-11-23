import { describe, expect, it, vi } from "vitest";
import { buildArchitecturePrompt, explainWithLocalAI } from "./localAI";
import type { Analysis } from "./analyzer";
const sample: Analysis = { nodes:[{id:"src/main.ts",label:"main.ts",extension:"ts",directory:"src",lines:12,external:false}],
  edges:[],unresolved:0 };
describe("local optional AI",()=>{
  it("sends only graph metadata to loopback Ollama after explicit invocation",async()=>{
    const mockFetch=vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({message:{content:"Architecture summary"}}),{status:200}));
    expect(await explainWithLocalAI(sample,"llama3.2",{fetcher:mockFetch})).toBe("Architecture summary");
    const [url, init]=mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:11434/api/chat");
    const body=String(init.body);
    expect(body).toContain("src/main.ts");
    expect(body).not.toContain("sourceCode");
    expect(init.credentials).toBe("omit");
    expect(buildArchitecturePrompt(sample)).toContain("totalFiles");
  });
  it("rejects invalid models without making network requests",async()=>{
    const mockFetch=vi.fn() as typeof fetch;
    await expect(explainWithLocalAI(sample,"../../evil",{fetcher:mockFetch})).rejects.toThrow(/model name/);
    expect(mockFetch).not.toHaveBeenCalled();
  });
  it("handles a missing local model without exposing details",async()=>{
    const mockFetch=vi.fn(async()=>new Response("not found",{status:404})) as typeof fetch;
    await expect(explainWithLocalAI(sample,"llama3.2",{fetcher:mockFetch})).rejects.toThrow(/ollama pull/);
  });
});
