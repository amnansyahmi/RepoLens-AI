import { describe, expect, it, vi } from "vitest";
import { explainWithCloudAI, cloudModelDefault, buildCloudReportPrompt } from "./cloudAI";
import { buildEngineeringReport } from "./health";
import { analyze } from "./analyzer";

const report=buildEngineeringReport(analyze([
  {path:"src/App.ts",content:"import './lib';"},
  {path:"src/lib.ts",content:"export const lib = 42;"}
]),{source:"owner/repo"});

describe("cloud BYOK request",()=>{
  it("sends the Gemini key in a header, not URL/body, and only metadata",async()=>{
    const client=vi.fn(async()=>new Response(JSON.stringify({
      candidates:[{content:{parts:[{text:"A source-grounded report"}]}}]
    }),{status:200}));
    const result=await explainWithCloudAI({
      provider:"gemini",model:"gemini-2.5-flash",apiKey:"test-key-unique",
      report,fetcher:client as typeof fetch
    });
    expect(result).toBe("A source-grounded report");
    const [url,init]=client.mock.calls[0] as unknown as [string,RequestInit];
    expect(url).toMatch(/^https:\/\/generativelanguage\.googleapis\.com\//);
    expect(url).not.toContain("test-key-unique");
    expect(init.headers).toMatchObject({"x-goog-api-key":"test-key-unique"});
    expect(String(init.body)).not.toContain("test-key-unique");
    expect(String(init.body)).not.toContain("export const lib = 42");
    expect(init.credentials).toBe("omit");
  });
  it("supports OpenRouter free router with Bearer header",async()=>{
    const client=vi.fn(async()=>new Response(JSON.stringify({choices:[{message:{content:"Report"}}]}),{status:200}));
    const answer=await explainWithCloudAI({
      provider:"openrouter",model:cloudModelDefault("openrouter"),
      apiKey:"sk-test",report,fetcher:client as typeof fetch
    });
    expect(answer).toBe("Report");
    const [url,init]=client.mock.calls[0] as unknown as [string,RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init.headers).toMatchObject({Authorization:"Bearer sk-test"});
    expect(String(init.body)).toContain("openrouter/free");
  });
  it("rejects a dangerous model string before making requests",async()=>{
    const client=vi.fn();
    await expect(explainWithCloudAI({
      provider:"gemini",model:"../../evil?token=123",
      apiKey:"test",report,fetcher:client as typeof fetch
    })).rejects.toThrow(/model/);
    expect(client).not.toHaveBeenCalled();
  });
  it("does not expose provider response details in key errors",async()=>{
    const client=vi.fn(async()=>new Response("supersecret",{status:401}));
    await expect(explainWithCloudAI({
      provider:"gemini",model:"gemini-2.5-flash",apiKey:"secret",report,fetcher:client as typeof fetch
    })).rejects.toThrow(/key rejected/);
  });
  it("limits the prompt and includes methodology",()=>{
    const prompt=buildCloudReportPrompt(report);
    expect(prompt.length).toBeLessThanOrEqual(16200);
    expect(prompt).toContain("structural");
  });
});
