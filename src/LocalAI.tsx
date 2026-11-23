import { useEffect, useRef, useState } from "react";
import { Bot, Check, Copy, LoaderCircle, ShieldCheck, Sparkles, X } from "lucide-react";
import type { Analysis } from "./analyzer";
import { explainWithLocalAI } from "./localAI";

export default function LocalAI({ analysis }: { analysis: Analysis }) {
  const [model, setModel] = useState("llama3.2");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    setAnswer("");
    setCopied(false);
    controller.current?.abort();
    controller.current = null;
    setWorking(false);
  }, [analysis]);

  async function run() {
    if (working || !analysis.nodes.length) return;
    const current = new AbortController();
    controller.current = current;
    setWorking(true); setError(""); setAnswer(""); setCopied(false);
    try {
      const message = await explainWithLocalAI(analysis, model, { signal: current.signal });
      if (!current.signal.aborted) setAnswer(message);
    } catch (failure) {
      if (!current.signal.aborted) {
        setError(failure instanceof Error ? failure.message : "Could not connect to local Ollama.");
      }
    } finally {
      if (controller.current === current) {
        controller.current = null;
        setWorking(false);
      }
    }
  }

  function cancel() {
    controller.current?.abort();
    controller.current = null;
    setWorking(false);
    setError("Explanation cancelled.");
  }

  async function copyAnswer() {
    try { await navigator.clipboard.writeText(answer); setCopied(true); }
    catch { setError("Clipboard access is unavailable in this browser."); }
  }

  return <section className="local-ai-panel liquid-panel" id="local-ai" aria-labelledby="local-ai-heading">
    <div className="section-title-group">
      <span className="section-icon"><Sparkles size={24}/></span>
      <span><h2 id="local-ai-heading">AI explanation <span className="local-label">(local)</span></h2>
        <p>Understand your architecture with a model on your computer.</p></span>
    </div>
    <div className="local-ai-status"><span className="status-dot"/> Optional Ollama connection</div>
    {answer ? <div className="local-ai-output" role="status">
      <div className="local-ai-output-head"><strong>Architecture summary</strong>
        <button onClick={() => void copyAnswer()} aria-label="Copy explanation">
          {copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>{answer}</pre>
    </div> : <div className="local-ai-empty">
      <span className="ai-glow-star"><Sparkles size={27}/></span>
      <div><strong>Get a clearer picture of your code.</strong>
        <p>Ask your local model to explain important modules, potential cycles, and refactoring opportunities.</p></div>
    </div>}
    <div className="local-ai-controls">
      <label htmlFor="ollama-model">Ollama model</label>
      <input id="ollama-model" type="text" value={model} disabled={working}
        onChange={event => setModel(event.target.value)} placeholder="llama3.2" />
      {working ? <button className="glass-button" onClick={cancel}><X size={16}/> Cancel</button>
        : <button className="gradient-button" disabled={!analysis.nodes.length} onClick={() => void run()}>
          <Sparkles size={17}/> Explain</button>}
    </div>
    {working && <div className="import-progress" role="status"><LoaderCircle size={16} className="spinner"/> Your local model is analyzing the graph…</div>}
    {error && <div className="github-feedback github-error" role="alert">{error}</div>}
    <p className="local-ai-foot"><ShieldCheck size={14}/> Only file names and graph relationships are sent to local Ollama, never source code. Requires Ollama running on your device.</p>
  </section>;
}
