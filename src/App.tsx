import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReactFlow, Background, Controls, MiniMap, MarkerType, type Edge, type Node } from "@xyflow/react";
import { Activity, ArrowDownToLine, ChartNoAxesCombined, Code2, FileCode2, FolderOpen, GitBranch, Github, Info, Layers3, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import { analyze, summarize, type SourceFile, type Analysis, type ModuleNode, type DependencyEdge } from "./analyzer";
import { architectureInsights, layoutGraph, projectGraph, type GraphMode, type LayoutDirection } from "./graph";
import { downloadGraph, type ExportFormat } from "./export";
import { demoFiles } from "./demo";
import GitHubImport from "./GitHubImport";
import LocalAI from "./LocalAI";
import type { GitHubImportResult } from "./github";
const MAX_FILES = 400;
const MAX_BYTES = 3_000_000;
function visualNodes(source: ModuleNode[], edges: DependencyEdge[], direction: LayoutDirection): Node[] {
  const places = layoutGraph(source, edges, direction);
  const lookups = new Map(places.map(place => [place.id, place]));
  return source.map(node => {
    const folder = node.extension === "folder";
    const dotnet = ["cs", "csproj"].includes(node.extension);
    const border = folder ? "#52bda8" : dotnet ? "#9077d6" : "#557abf";
    return {
      id:node.id,position:{x:lookups.get(node.id)?.x||0,y:lookups.get(node.id)?.y||0},
      data:{label:node.label},type:"default",
      style:{width:240,background:folder?"#143b3f":"#17243b",border:"1px solid "+border,borderRadius:12,
        color:"#f1f6ff",padding:"15px 12px",fontSize:12,boxShadow:"0 8px 22px #0003",
        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}
    };
  });
}
async function readFiles(fileList: FileList): Promise<SourceFile[]> {
  const all = [...fileList].filter(f => (/\.(tsx?|jsx?|mjs|cjs|cs|csproj)$/i.test(f.name) || /^(tsconfig|jsconfig)\.json$/i.test(f.name)) && !/(^|\/)(node_modules|dist|build|\.git|bin|obj)(\/|$)/i.test(f.webkitRelativePath || f.name));
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
  const [remoteBusy,setRemoteBusy] = useState(false);
  const [importReport,setImportReport] = useState<GitHubImportResult|null>(null);
  const fileInput=useRef<HTMLInputElement>(null);
  const [graphMode,setGraphMode] = useState<GraphMode>("files");
  const [direction,setDirection] = useState<LayoutDirection>("LR");
  const [exportFormat,setExportFormat] = useState<ExportFormat>("svg");
  const [exporting,setExporting] = useState(false);
  const [semanticResult,setSemanticResult] = useState<{files:SourceFile[];analysis:Analysis}|null>(null);
  const [analyzing,setAnalyzing] = useState(false);
  const [semanticWarning,setSemanticWarning] = useState("");
  const basicAnalysis=useMemo(()=>analyze(files),[files]);
  useEffect(()=>{
    let active=true;
    setAnalyzing(true);
    setSemanticWarning("");
    import("./semantic").then(module=>module.analyzeSemantically(files)).then(result=>{
      if(active)setSemanticResult({files,analysis:result});
    }).catch(e=>{if(active)setSemanticWarning("Advanced analysis unavailable. Showing lightweight import results: "+(e instanceof Error?e.message:"Unknown error"));})
      .finally(()=>{if(active)setAnalyzing(false)});
    return ()=>{active=false};
  },[files]);
  const analysis=semanticResult?.files===files?semanticResult.analysis:basicAnalysis;
  const stats=useMemo(()=>summarize(analysis),[analysis]);
  const insights=useMemo(()=>architectureInsights(analysis),[analysis]);
  const graph=useMemo(()=>projectGraph(analysis,graphMode),[analysis,graphMode]);
  const visible=useMemo(()=>analysis.nodes.filter(n=>n.id.toLowerCase().includes(query.toLowerCase())),[analysis,query]);
  const graphVisible=useMemo(()=>graph.nodes.filter(n=>n.id.toLowerCase().includes(query.toLowerCase())),[graph,query]);
  const visibleIds=useMemo(()=>new Set(graphVisible.map(n=>n.id)),[graphVisible]);
  const graphEdges=useMemo(()=>graph.edges.filter(edge=>visibleIds.has(edge.source)&&visibleIds.has(edge.target)),[graph,visibleIds]);
  const nodes=useMemo(()=>visualNodes(graphVisible,graphEdges,direction),[graphVisible,graphEdges,direction]);
  const edges:Edge[]=useMemo(()=>graphEdges.map((e,i)=>({id:"edge-"+i,source:e.source,target:e.target,animated:false,
    markerEnd:{type:MarkerType.ArrowClosed,color:"#6997c8"},style:{stroke:e.kind==="namespace"?"#9280cf":"#6997c8",strokeWidth:1.6}})),[graphEdges]);
  const selectedDir=selected?.startsWith("dir:")?selected.slice(4):null;
  const directoryFiles=selectedDir?analysis.nodes.filter(n=>n.directory===selectedDir):[];
  const current=analysis.nodes.find(n=>n.id===selected);
  const sourceContent=files.find(f=>f.path===selected)?.content;
  const onFiles=useCallback(async (list:FileList|null)=>{
    if(!list)return;
    try {
      const parsed=await readFiles(list);
      if(!parsed.length)throw new Error("No supported source files found. Select a folder with .ts, .tsx, .js, .jsx, .cs, or .csproj files.");
      setFiles(parsed);setSource(list[0]?.webkitRelativePath.split("/")[0]||"Local project");setSelected(null);setQuery("");setError("");setImportReport(null);
    }catch(e){setError(e instanceof Error?e.message:"Could not read files.");}
    if(fileInput.current)fileInput.current.value="";
  },[]);
  const onImported = useCallback((result:GitHubImportResult)=>{
    setFiles(result.files);setSource(result.fullName);setSelected(null);setQuery("");setError("");setImportReport(result);
  },[]);
  async function exportSelected(){
    setExporting(true);setError("");
    try{await downloadGraph({nodes:graphVisible,edges:graphEdges,unresolved:analysis.unresolved},exportFormat,direction)}
    catch(e){setError(e instanceof Error?e.message:"Could not export graph")}
    finally{setExporting(false)}
  }
  return <div className="app">
    <header className="topbar">
      <div className="brand"><div className="brandmark"><Layers3 size={22}/></div><div><strong>RepoLens <span>AI</span></strong><small>Codebase intelligence</small></div></div>
      <div className="top-actions"><span className="privacy"><ShieldCheck size={14}/> Browser analysis · No source uploads</span><a className="github-link" href="https://github.com/amnansyahmi/RepoLens-AI" target="_blank" rel="noopener noreferrer"><Github size={16}/> <span>GitHub</span></a></div>
    </header>
    <div className="workspace">
      <aside className="sidebar">
        <div className="section-head"><span>WORKSPACE</span><button aria-label="About RepoLens" title="About RepoLens" onClick={()=>setShowInfo(!showInfo)}><Info size={16}/></button></div>
        {showInfo&&<div className="note">RepoLens inspects source files in your browser. JS/TS imports use TypeScript compiler syntax trees, including basic tsconfig aliases. C# project references and using-namespace connections are heuristic, not full Roslyn class/type analysis. No AI chat or API keys are required.</div>}
        <div className="repo-card"><div className="repo-icon"><FolderOpen size={20}/></div><div className="repo-meta"><strong title={source}>{source}</strong><span>{analysis.nodes.length} source files</span></div></div>
        <GitHubImport onImported={onImported} onBusyChange={setRemoteBusy}/>
        <input ref={fileInput} className="sr-only" aria-label="Choose source folder" type="file" multiple webkitdirectory="" directory="" onChange={e=>void onFiles(e.target.files)}/>
        <button className="primary upload" disabled={remoteBusy} onClick={()=>fileInput.current?.click()}><FolderOpen size={16}/> Open local folder</button>
        <button className="secondary" disabled={remoteBusy} onClick={()=>{setFiles(demoFiles);setSource("Example repository");setSelected(null);setQuery("");setError("");setImportReport(null);}}><Sparkles size={15}/> Load example</button>
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
        <div className="hero"><div><div className="eyebrow"><span className="pulse"/> ARCHITECTURE EXPLORER <span className="version">v1.0</span></div><h1>Understand your codebase<span>.</span></h1><p>Explore modules, uncover dependencies, and see how everything connects.</p></div><div className="export-tools"><label htmlFor="export-format" className="sr-only">Export format</label>
  <select id="export-format" value={exportFormat} onChange={e=>setExportFormat(e.target.value as ExportFormat)}
    className="graph-select" aria-label="Export format">
    <option value="svg">SVG</option><option value="png">PNG</option><option value="json">JSON</option><option value="mermaid">Mermaid</option>
  </select><button className="export" disabled={exporting || nodes.length===0} onClick={()=>void exportSelected()}>
    <ArrowDownToLine size={16}/> {exporting?"Exporting…":"Export graph"}</button></div></div>
        {importReport&&<div className={"github-report "+(importReport.partial?"partial":"complete")} role="status"><span><Github size={15}/> <strong>{importReport.fullName}</strong> · {importReport.branch} · {importReport.files.length} imported files{importReport.partial?" · Partial analysis":""}</span><a href={importReport.url} target="_blank" rel="noopener noreferrer">View repository</a>{importReport.partial&&<p>{importReport.skipped} supported files were not selected and {importReport.failed} failed to load. Missing dependencies may not appear in the graph.</p>}{importReport.usedApiFallback&&<p>GitHub API source fallback was used; public API rate limits may affect large repositories.</p>}</div>}
        <div className="analysis-summary" role="status">{analyzing?"Analyzing source syntax…":semanticWarning||"Syntax-aware JS/TS analysis · C# project and namespace relationships"} · {analysis.unresolved} unresolved local references</div>
        <div className="stat-grid">
          <div className="stat"><div className="stat-icon blue"><FileCode2 size={18}/></div><div><small>Source files</small><strong>{analysis.nodes.length}</strong></div></div>
          <div className="stat"><div className="stat-icon violet"><GitBranch size={18}/></div><div><small>Dependencies</small><strong>{analysis.edges.length}</strong></div></div>
          <div className="stat"><div className="stat-icon mint"><Code2 size={18}/></div><div><small>Lines of code</small><strong>{stats.totalLines.toLocaleString()}</strong></div></div>
          <div className="stat"><div className="stat-icon amber"><Activity size={18}/></div><div><small>Directories</small><strong>{stats.directories.length}</strong></div></div>
        </div>
        <div className="graph-panel"><div className="panel-toolbar"><div><span className="panel-icon"><ChartNoAxesCombined size={17}/></span><strong>Dependency graph</strong><span className="panel-label">{nodes.length} nodes · {edges.length} links</span></div>
          <div className="graph-view-tools">
            <label className="sr-only" htmlFor="graph-mode">Graph detail</label>
            <select id="graph-mode" className="graph-select" value={graphMode} onChange={e=>setGraphMode(e.target.value as GraphMode)}><option value="files">Files</option><option value="directories">Directories</option></select>
            <label className="sr-only" htmlFor="graph-direction">Graph direction</label>
            <select id="graph-direction" className="graph-select" value={direction} onChange={e=>setDirection(e.target.value as LayoutDirection)}><option value="LR">Left → Right</option><option value="TB">Top → Bottom</option></select>
          </div></div>
          <div className="graph-canvas"><ReactFlow key={source+query+graphMode+direction} nodes={nodes} edges={edges} onNodeClick={(_,node)=>setSelected(node.id)} fitView fitViewOptions={{padding:0.2}} minZoom={0.2} maxZoom={1.8} nodesDraggable nodesConnectable={false} elementsSelectable proOptions={{hideAttribution:false}}><Background color="#27354b" gap={22} size={1}/><Controls showInteractive={false}/><MiniMap nodeColor="#4d75c4" maskColor="#0b1220bb" pannable zoomable/></ReactFlow></div>
          <div className="graph-foot"><span><span className="legend-dot"/> Internal module reference</span><span>Click a node to inspect its files · Scroll to zoom</span></div>
        </div>
        <div className="insight-strip"><div><strong>{insights.cycles.length}</strong><span>Dependency cycles</span></div><div><strong>{insights.isolated.length}</strong><span>Unconnected files</span></div><div><strong>{insights.entrypoints.length}</strong><span>Potential entrypoints</span></div><div><strong>{insights.languages.map(([name,count])=>name+": "+count).join(" · ")||"No files"}</strong><span>Language distribution</span></div></div>
        {insights.cycles.length>0&&<div className="cycle-warning"><strong>Cycles detected:</strong> {insights.cycles.slice(0,3).map(group=>group.map(path=>path.split("/").pop()).join(" → ")).join(" · ")}</div>}
        <div className="bottom-grid"><section className="insight"><div className="insight-title"><Layers3 size={17}/><strong>Most referenced modules</strong></div>{stats.mostImported.length?stats.mostImported.slice(0,4).map(([path,count])=><button key={path} className="insight-row" onClick={()=>setSelected(path)}><span title={path}>{path.split("/").pop()}</span><b>{count} references</b></button>):<p className="muted">No local dependencies detected.</p>}</section>
        <section className="insight"><div className="insight-title"><FolderOpen size={17}/><strong>Top directories</strong></div>{stats.directories.slice(0,4).map(([path,count])=><div className="insight-row" key={path}><span title={path}>{path}</span><b>{count} files</b></div>)}</section></div>
        <LocalAI analysis={analysis}/>
      </main>
      {selected&&<div className="detail-backdrop" onClick={()=>setSelected(null)}><aside className="detail" onClick={e=>e.stopPropagation()} aria-label="File details"><div className="detail-head"><strong>File details</strong><button aria-label="Close details" onClick={()=>setSelected(null)}><X size={19}/></button></div><div className="detail-body"><div className="detail-icon"><FileCode2 size={24}/></div><h2>{current?.label||selectedDir}</h2><p className="file-path">{selected}</p><div className="detail-stats"><span>{current?.lines||(selectedDir?directoryFiles.reduce((n,f)=>n+f.lines,0):0)} lines</span><span>{selectedDir?directoryFiles.length+" files":analysis.edges.filter(e=>e.target===selected).length+" incoming"}</span><span>{analysis.edges.filter(e=>e.source===selected).length} outgoing</span></div><h3>{selectedDir?"Directory files":"Source preview"}</h3>{selectedDir?<div className="directory-detail">{directoryFiles.map(file=><button key={file.id} onClick={()=>setSelected(file.id)}><FileCode2 size={14}/>{file.label}</button>)}</div>:<pre><code>{sourceContent||"No preview available"}</code></pre>}</div></aside></div>}
    </div>
  </div>;
}
declare module "react" { interface InputHTMLAttributes<T> { webkitdirectory?: string; directory?: string } }
