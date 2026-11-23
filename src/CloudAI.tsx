import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Bot, Check, Copy, KeyRound, LoaderCircle, ShieldCheck, Sparkles, X } from "lucide-react";
import type { EngineeringReport } from "./health";
import { cloudModelDefault, explainWithCloudAI, type CloudProvider } from "./cloudAI";

export default function CloudAI({report}:{report:EngineeringReport}) {
  const [provider,setProvider]=useState<CloudProvider>("openrouter");
  const [model,setModel]=useState(cloudModelDefault("openrouter"));
  const [key,setKey]=useState("");
  const [consent,setConsent]=useState(false);
  const [answer,setAnswer]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [copied,setCopied]=useState(false);
  const controller=useRef<AbortController|null>(null);

  useEffect(()=>()=>controller.current?.abort(),[]);
  // Never send a previous repository's report after the project changes.
  useEffect(()=>{
    controller.current?.abort();controller.current=null;
    setAnswer("");setError("");setBusy(false);setConsent(false);setCopied(false);
  },[report]);

  function switchProvider(next:CloudProvider){
    controller.current?.abort();controller.current=null;setBusy(false);
    setProvider(next);setModel(cloudModelDefault(next));
    setKey("");setConsent(false);setAnswer("");setError("");setCopied(false);
  }
  function cancel(){
    controller.current?.abort();controller.current=null;setBusy(false);setError("Request cancelled.");
  }
  async function analyze(){
    if(busy||!consent||!key.trim()||!report.sampleSize)return;
    const next=new AbortController();
    controller.current=next;setBusy(true);setError("");setAnswer("");setCopied(false);
    try{
      const result=await explainWithCloudAI({provider,model,apiKey:key,report,signal:next.signal});
      if(!next.signal.aborted) setAnswer(result);
    }catch(failure){
      if(!next.signal.aborted)setError(failure instanceof Error?failure.message:"The provider request failed.");
    }finally{
      if(controller.current===next){controller.current=null;setBusy(false);}
    }
  }
  async function copy(){
    try{await navigator.clipboard.writeText(answer);setCopied(true);}catch{setError("Copy is unavailable in this browser.");}
  }
  return <section id="byok" className="cloud-ai-panel liquid-panel" aria-labelledby="byok-heading">
    <div className="section-header">
      <div className="section-title-group">
        <span className="section-icon"><KeyRound size={23}/></span>
        <span><h2 id="byok-heading">Cloud AI with your key</h2><p>Optional reports from Gemini or OpenRouter. No hosted RepoLensa AI quota.</p></span>
      </div>
      <span className="cloud-badge"><ShieldCheck size={14}/> BYOK · Opt-in</span>
    </div>
    <div className="cloud-body">
      <div className="byok-fields">
        <label>AI provider
          <select value={provider} disabled={busy} onChange={event=>switchProvider(event.target.value as CloudProvider)}>
            <option value="openrouter">OpenRouter (free-model option)</option>
            <option value="gemini">Google Gemini</option>
          </select>
        </label>
        <label>Model ID
          <input type="text" value={model} disabled={busy} autoComplete="off" spellCheck={false}
            onChange={event=>setModel(event.target.value)} placeholder={cloudModelDefault(provider)}/>
        </label>
        <label>API key
          <input type="password" value={key} disabled={busy}
            autoComplete="off" autoCapitalize="off" spellCheck={false}
            onChange={event=>setKey(event.target.value)} placeholder="Enter your provider key"/>
        </label>
      </div>
      <div className="byok-help">
        <Bot size={16}/> {provider==="openrouter"?
          <span>Use <code>openrouter/free</code> for free-model routing, subject to provider quotas. <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noopener noreferrer">Create OpenRouter key <ArrowUpRight size={12}/></a></span>:
          <span>Use an available Gemini model and your own API key. <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer">Create Gemini key <ArrowUpRight size={12}/></a></span>}
      </div>
      <label className="byok-consent">
        <input type="checkbox" checked={consent} disabled={busy}
          onChange={event=>setConsent(event.target.checked)}/>
        <span>I agree to send this report's <strong>file paths, graph metrics and findings</strong> to {provider==="gemini"?"Google Gemini":"OpenRouter"} to generate an explanation. No source code is included.</span>
      </label>
      <div className="byok-actions">
        {busy?<button className="glass-button" onClick={cancel}><X size={16}/> Cancel</button>:
          <button className="gradient-button" disabled={!consent||!key.trim()||!model.trim()||!report.sampleSize}
            onClick={()=>void analyze()}><Sparkles size={16}/> Generate AI report</button>}
        <button className="glass-button" disabled={busy||!key} onClick={()=>{setKey("");setConsent(false)}}>Clear key</button>
      </div>
      {busy&&<div className="byok-status" role="status"><LoaderCircle className="spinner" size={15}/> Waiting for {provider}…</div>}
      {error&&<div className="github-feedback github-error" role="alert">{error}</div>}
      {answer&&<div className="byok-result" role="status">
        <div><strong>AI architecture recommendations</strong><button onClick={()=>void copy()}><Copy size={15}/>{copied?<><Check size={12}/> Copied</>:"Copy"}</button></div>
        <pre>{answer}</pre>
      </div>}
      <p className="byok-privacy"><ShieldCheck size={15}/> Keys stay in this tab's React memory only; RepoLensa doesn't save them, use cookies or proxy requests. The key and metadata are sent directly from your browser to your selected provider. Browser extensions, developer tools and provider logs may access request data. Prefer a restricted, low-spend key. Pricing and free quotas depend on your provider and model.</p>
    </div>
  </section>;
}
