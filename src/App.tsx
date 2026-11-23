import { useCallback, useMemo, useRef, useState } from "react";
import { ReactFlow, Background, Controls, MiniMap, MarkerType, type Edge, type Node } from "@xyflow/react";
import { Activity, ArrowDownToLine, ChartNoAxesCombined, Code2, FileCode2, FolderOpen, GitBranch, Github, Info, Layers3, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import { analyze, summarize, type SourceFile } from "./analyzer";
import { demoFiles } from "./demo";
const MAX_FILES = 400;
const MAX_BYTES = 3_000_000;
function layout(nodes: ReturnType<typeof analyze>["nodes"], edges: ReturnType<typeof analyze>["edges"]): Node[] {
  const incoming = new Map<string, number>();
  for (const edge of edges) incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1);
  const sorted = [...nodes].sort((a,b) => (incoming.get(b.id)||0)-(incoming.get(a.id)||0) || a.id.localeCompare(b.id));
  return sorted.map((node, index) => ({
    id:node.id, position:{x:(index%4)*275,y:Math.floor(index/4)*135}, data:{label:node.label,subtitle:node.directory},
    type:"default", style:{width:225,background:"#151e33",border:"1px solid #34415b",borderRadius:14,color:"#eff5ff",padding:"12px 14px",fontSize:13,boxShadow:"0 8px 24px #0003"}
  }));
}
async function readFiles(fileList: FileList): Promise<SourceFile[]> {
  const all = [...fileList].filter(f => /\.(tsx?|jsx?|mjs|cjs|cs|csproj)$/i.test(f.name) && !/(^|\/)(node_modules|dist|build|\.git|bin|obj)(\/|$)/i.test(f.webkitRelativePath || f.name));
  if(all.length > MAX_FILES) throw new Error("Choose a smaller folder (up to 400 source files).");
  if(all.reduce((sum,f)=>sum+f.size,0)>MAX_BYTES) throw new Error("Folder exceeds the 3 MB source analysis limit.");
  return Promise.all(all.map(async f => ({path:f.webkitRelativePath || f.name,content:await f.text()})));
}
export default function App() {
  const [files,setFiles] = useState<SourceFile[]>(demoFiles);
  const [source,setSource] = useState("Example repository");
  const [query,setQuery] = useState("");
  const [selected,setSelected] = useState<string|null>(null);
  const [error,setError] = useState("");
  const [showInfo,setShowInfo] = useState(false);
  const fileInput=useRef<HTMLInputElement>(null);
  const analysis=useMemo(()=>analyze(files),[files]);
  const stats=useMemo(()=>summarize(analysis),[analysis]);
  const visible=useMemo(()=>analysis.nodes.filter(n=>n.id.toLowerCase().includes(query.toLowerCase())),[analysis,query]);
  const visibleIds=useMemo(()=>new Set(visible.map(n=>n.id)),[visible]);
  const nodes=useMemo(()=>layout(visible,analysis.edges),[visible,analysis.edges]);
  const edges:Edge[]=useMemo(()=>analysis.edges.filter(edge=>visibleIds.has(edge.source)&&visibleIds.has(edge.target)).map((e,i)=>({id:"edge-"+i,source:e.source,target:e.target,animated:false,markerEnd:{type:MarkerType.ArrowClosed,color:"#5e7499"},style:{stroke:"#5e7499",strokeWidth:1.5}})),[analysis.edges,visibleIds]);
  const current=analysis.nodes.find(n=>n.id===selected);
  const sourceContent=files.find(f=>f.path===selected)?.content;
  const onFiles=useCallback(async (list:FileList|null)=>{
    if(!list)return;
    try {
      const parsed=await readFiles(list);
      if(!parsed.length)throw new Error("No supported source files found. Select a folder with .ts, .tsx, .js, .jsx, .cs, or .csproj files.");
      setFiles(parsed);setSource(list[0]?.webkitRelativePath.split("/")[0]||"Local project");setSelected(null);setQuery("");setError("");
    }catch(e){setError(e instanceof Error?e.message:"Could not read files.");}
    if(fileInput.current)fileInput.current.value="";
  },[]);
  function downloadJSON(){
    const blob=new Blob([JSON.stringify({source,analysis,summary:stats},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="repolens-analysis.json";a.click();URL.revokeObjectURL(url);
  }
  return <div className="app">
    <header className="topbar">
      <div className="brand"><div className="brandmark"><Layers3 size={22}/></div><div><strong>RepoLens <span>AI</span></strong><small>Codebase intelligence</small></div></div>
      <div className="top-actions"><span className="privacy"><ShieldCheck size={14}/> Local-first · No uploads</span><a className="github-link" href="https://github.com/amnansyahmi/RepoLens-AI" target="_blank" rel="noopener noreferrer"><Github size={16}/> <span>GitHub</span></a></div>
    </header>
    <div className="workspace">
      <aside className="sidebar">
        <div className="section-head"><span>WORKSPACE</span><button aria-label="About RepoLens" title="About RepoLens" onClick={()=>setShowInfo(!showInfo)}><Info size={16}/></button></div>
        {showInfo&&<div className="note">RepoLens inspects source files in your browser. C# project references and JS/TS imports are supported in this MVP; C# class dependencies and AI chat are planned.</div>}
        <div className="repo-card"><div className="repo-icon"><FolderOpen size={20}/></div><div className="repo-meta"><strong title={source}>{source}</strong><span>{analysis.nodes.length} source files</span></div></div>
        <input ref={fileInput} className="sr-only" aria-label="Choose source folder" type="file" multiple webkitdirectory="" directory="" onChange={e=>void onFiles(e.target.files)}/>
        <button className="primary upload" onClick={()=>fileInput.current?.click()}><FolderOpen size={16}/> Open local folder</button>
        <button className="secondary" onClick={()=>{setFiles(demoFiles);setSource("Example repository");setSelected(null);setQuery("");setError("");}}><Sparkles size={15}/> Load example</button>
        {error&&<div className="error" role="alert">{error}<button onClick={()=>setError("")} aria-label="Dismiss error"><X size={14}/></button></div>}
        <div className="divider"/>
        <div className="section-head"><span>EXPLORER</span><span className="count">{analysis.nodes.length}</span></div>
        <label className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search files..." aria-label="Search files"/></label>
        <div className="file-list">
          {visible.map(node=><button className={"file-item "+(selected===node.id?"active":"")} key={node.id} title={node.id} onClick={()=>setSelected(node.id)}><FileCode2 size={15}/><span>{node.label}<small>{node.directory}</small></span></button>)}
          {!visible.length&&<p className="empty-files">No files match.</p>}
        </div>
        <div className="sidebar-bottom"><ShieldCheck size={14}/> Files stay in this browser session</div>
      </aside>
      <main className="content">
        <div className="hero"><div><div className="eyebrow"><span className="pulse"/> ARCHITECTURE EXPLORER <span className="version">v0.1</span></div><h1>Understand your codebase<span>.</span></h1><p>Explore modules, uncover dependencies, and see how everything connects.</p></div><button className="export" onClick={downloadJSON}><ArrowDownToLine size={16}/> Export JSON</button></div>
        <div className="stat-grid">
          <div className="stat"><div className="stat-icon blue"><FileCode2 size={18}/></div><div><small>Source files</small><strong>{analysis.nodes.length}</strong></div></div>
          <div className="stat"><div className="stat-icon violet"><GitBranch size={18}/></div><div><small>Dependencies</small><strong>{analysis.edges.length}</strong></div></div>
          <div className="stat"><div className="stat-icon mint"><Code2 size={18}/></div><div><small>Lines of code</small><strong>{stats.totalLines.toLocaleString()}</strong></div></div>
          <div className="stat"><div className="stat-icon amber"><Activity size={18}/></div><div><small>Directories</small><strong>{stats.directories.length}</strong></div></div>
        </div>
        <div className="graph-panel"><div className="panel-toolbar"><div><span className="panel-icon"><ChartNoAxesCombined size={17}/></span><strong>Dependency graph</strong><span className="panel-label">{nodes.length} nodes · {edges.length} links</span></div><span className="panel-help">Scroll to zoom · Drag to pan</span></div>
          <div className="graph-canvas"><ReactFlow key={source+query} nodes={nodes} edges={edges} onNodeClick={(_,node)=>setSelected(node.id)} fitView fitViewOptions={{padding:0.2}} minZoom={0.2} maxZoom={1.8} nodesDraggable nodesConnectable={false} elementsSelectable proOptions={{hideAttribution:false}}><Background color="#27354b" gap={22} size={1}/><Controls showInteractive={false}/><MiniMap nodeColor="#4d75c4" maskColor="#0b1220bb" pannable zoomable/></ReactFlow></div>
          <div className="graph-foot"><span><span className="legend-dot"/> Internal module reference</span><span>Click a node to inspect its source</span></div>
        </div>
        <div className="bottom-grid"><section className="insight"><div className="insight-title"><Layers3 size={17}/><strong>Most referenced modules</strong></div>{stats.mostImported.length?stats.mostImported.slice(0,4).map(([path,count])=><button key={path} className="insight-row" onClick={()=>setSelected(path)}><span title={path}>{path.split("/").pop()}</span><b>{count} references</b></button>):<p className="muted">No local dependencies detected.</p>}</section>
        <section className="insight"><div className="insight-title"><FolderOpen size={17}/><strong>Top directories</strong></div>{stats.directories.slice(0,4).map(([path,count])=><div className="insight-row" key={path}><span title={path}>{path}</span><b>{count} files</b></div>)}</section></div>
      </main>
      {selected&&<div className="detail-backdrop" onClick={()=>setSelected(null)}><aside className="detail" onClick={e=>e.stopPropagation()} aria-label="File details"><div className="detail-head"><strong>File details</strong><button aria-label="Close details" onClick={()=>setSelected(null)}><X size={19}/></button></div><div className="detail-body"><div className="detail-icon"><FileCode2 size={24}/></div><h2>{current?.label}</h2><p className="file-path">{selected}</p><div className="detail-stats"><span>{current?.lines} lines</span><span>{analysis.edges.filter(e=>e.target===selected).length} incoming</span><span>{analysis.edges.filter(e=>e.source===selected).length} outgoing</span></div><h3>Source preview</h3><pre><code>{sourceContent||"No preview available"}</code></pre></div></aside></div>}
    </div>
  </div>;
}
declare module "react" { interface InputHTMLAttributes<T> { webkitdirectory?: string; directory?: string } }
