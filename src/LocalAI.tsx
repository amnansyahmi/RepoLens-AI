import { useEffect, useRef, useState } from "react";
import { Bot, Copy, LoaderCircle, Sparkles, X } from "lucide-react";
import type { Analysis } from "./analyzer";
import { explainWithLocalAI } from "./localAI";

export default function LocalAI({ analysis }: { analysis: Analysis }) {
  const [model,setModel]=useState("llama3.2");
  const [answer,setAnswer]=useState("");
  const [error,setError]=useState("");
  const [working,setWorking]=useState(false);
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  async function run(){
    if(working)return;
    const current=new AbortController();controller.current=current;
    setWorking(true);setError("");setAnswer("");
    try{const message=await explainWithLocalAI(analysis,model,{signal:current.signal});
      if(!current.signal.aborted)setAnswer(message)}
    catch(e){if(!current.signal.aborted)setError(e instanceof Error?e.message:"Could not connect to local Ollama.")}
    finally{if(controller.current===current){controller.current=null;setWorking(false)}}
  }
  function cancel(){controller.current?.abort();controller.current=null;setWorking(false);setError("Explanation cancelled.")}
  return <section className="insight local-ai">
    <div className="insight-title"><Bot size={18}/><strong>Explain architecture with local AI</strong><span className="local-pill">Optional · Ollama</span></div>
    <p>Run a local model to explain dependency hotspots, cycles and design improvements. Only file paths and graph relationships go to Ollama on this computer — never source contents or a cloud service.</p>
    <div className="local-ai-form">
      <label htmlFor="ollama-model">Local model</label>
      <input id="ollama-model" type="text" value={model} disabled={working} onChange={e=>setModel(e.target.value)} placeholder="llama3.2"/>
      {working?<button className="secondary" onClick={cancel}><X size={15}/> Cancel</button>:
        <button className="primary" disabled={!analysis.nodes.length} onClick={()=>void run()}><Sparkles size={15}/> Explain</button>}
    </div>
    {working&&<div className="import-progress" role="status"><LoaderCircle className="spinner" size={14}/> Local model is analyzing graph metadata…</div>}
    {error&&<div className="github-feedback github-error" role="alert">{error}</div>}
    {answer&&<div className="ai-output"><div><strong>Architecture explanation</strong><button onClick={()=>void navigator.clipboard?.writeText(answer)} title="Copy explanation" aria-label="Copy explanation"><Copy size={15}/></button></div><pre>{answer}</pre></div>}
    <small>Requires a locally installed Ollama model. Direct browser access may require setting OLLAMA_ORIGINS. AI results are suggestions, not verified code analysis.</small>
  </section>;
}
