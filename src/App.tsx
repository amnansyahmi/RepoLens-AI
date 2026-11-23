import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReactFlow, Background, Controls, MiniMap, MarkerType, type Edge, type Node } from "@xyflow/react";
import {
  ArrowDownToLine, ArrowRight, ArrowUpRight, Check, CircleHelp, Code2, FileCode2,
  FolderOpen, GitBranch, Github, Grid2X2, Layers3, Network, Play,
  Search, ShieldCheck, Sparkles, X, type LucideIcon
} from "lucide-react";
import { analyze, type SourceFile, type Analysis, type ModuleNode, type DependencyEdge } from "./analyzer";
import { architectureInsights, layoutGraph, projectGraph, type GraphMode, type LayoutDirection } from "./graph";
import { downloadGraph, type ExportFormat } from "./export";
import { demoFiles } from "./demo";
import GitHubImport from "./GitHubImport";
import LocalAI from "./LocalAI";
import type { GitHubImportResult } from "./github";

const MAX_FILES = 400;
const MAX_BYTES = 3_000_000;

function visualNodes(items: ModuleNode[], edges: DependencyEdge[], direction: LayoutDirection): Node[] {
  const positions = new Map(layoutGraph(items, edges, direction).map(item => [item.id, item]));
  return items.map(node => {
    const folder = node.extension === "folder";
    const dotnet = ["cs", "csproj"].includes(node.extension);
    const kind = folder ? "directory" : dotnet ? "dotnet" : "module";
    return {
      id: node.id,
      position: { x: positions.get(node.id)?.x ?? 0, y: positions.get(node.id)?.y ?? 0 },
      type: "default",
      data: { label: node.label },
      className: "glass-flow-node node-" + kind,
      style: {
        width: 240, minHeight: 74, padding: "19px 15px",
        borderRadius: 18, border: "1px solid rgba(255,255,255,.85)",
        background: folder
          ? "linear-gradient(130deg,rgba(190,240,247,.92),rgba(236,243,255,.92))"
          : dotnet
          ? "linear-gradient(130deg,rgba(235,220,255,.92),rgba(255,236,246,.86))"
          : "linear-gradient(130deg,rgba(235,245,255,.94),rgba(235,225,255,.84))",
        color: "#2b3663", fontWeight: 700, fontSize: 13,
        boxShadow: "0 12px 28px rgba(84,104,161,.15),inset 0 1px 0 #fff",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
      }
    };
  });
}

async function readFiles(fileList: FileList): Promise<SourceFile[]> {
  const picked = [...fileList].filter(file =>
    (/\.(tsx?|jsx?|mjs|cjs|cs|csproj)$/i.test(file.name) || /^(tsconfig|jsconfig)\.json$/i.test(file.name)) &&
    !/(^|\/)(node_modules|dist|build|\.git|bin|obj|coverage)(\/|$)/i.test(file.webkitRelativePath || file.name)
  );
  if (picked.length > MAX_FILES) throw new Error("Please choose a folder with 400 or fewer supported source files.");
  if (picked.reduce((total, file) => total + file.size, 0) > MAX_BYTES) {
    throw new Error("Your folder exceeds the 3 MB source analysis limit.");
  }
  return Promise.all(picked.map(async file => ({
    path: file.webkitRelativePath || file.name, content: await file.text()
  })));
}

type StatCardProps = { icon: LucideIcon; label: string; value: string; tone: string };
function StatCard({ icon: Icon, label, value, tone }: StatCardProps) {
  return <div className={"stat-card stat-" + tone}>
    <span className="stat-symbol"><Icon size={23} strokeWidth={1.9} /></span>
    <div><strong>{value}</strong><span>{label}</span></div>
  </div>;
}

const formats: { id: ExportFormat; label: string; detail: string; icon: LucideIcon }[] = [
  { id: "png", label: "PNG", detail: "Shareable image", icon: Grid2X2 },
  { id: "svg", label: "SVG", detail: "Scalable vector", icon: Network },
  { id: "mermaid", label: "Mermaid", detail: "Diagram source", icon: Code2 },
  { id: "json", label: "JSON", detail: "Graph data", icon: Layers3 }
];

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function App() {
  const [files, setFiles] = useState<SourceFile[]>(demoFiles);
  const [source, setSource] = useState("Example repository");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [importReport, setImportReport] = useState<GitHubImportResult | null>(null);
  const [inputMode, setInputMode] = useState<"github" | "local">("github");
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [graphMode, setGraphMode] = useState<GraphMode>("files");
  const [direction, setDirection] = useState<LayoutDirection>("LR");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [exporting, setExporting] = useState(false);
  const [semanticResult, setSemanticResult] = useState<{ files: SourceFile[]; analysis: Analysis } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [semanticWarning, setSemanticWarning] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const basicAnalysis = useMemo(() => analyze(files), [files]);
  useEffect(() => {
    let active = true;
    setAnalyzing(true);
    setSemanticWarning("");
    import("./semantic")
      .then(module => module.analyzeSemantically(files))
      .then(result => { if (active) setSemanticResult({ files, analysis: result }); })
      .catch(err => {
        if (active) setSemanticWarning("Advanced analysis unavailable: " +
          (err instanceof Error ? err.message : "Unknown error"));
      })
      .finally(() => { if (active) setAnalyzing(false); });
    return () => { active = false; };
  }, [files]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setSelected(null); setShowInfo(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const analysis = semanticResult?.files === files ? semanticResult.analysis : basicAnalysis;
  const insights = useMemo(() => architectureInsights(analysis), [analysis]);
  const graph = useMemo(() => projectGraph(analysis, graphMode), [analysis, graphMode]);
  const fileMatches = useMemo(() => analysis.nodes.filter(node =>
    node.id.toLowerCase().includes(query.toLowerCase())), [analysis, query]);
  const graphMatches = useMemo(() => graph.nodes.filter(node =>
    node.id.toLowerCase().includes(query.toLowerCase())), [graph, query]);
  const visibleIds = useMemo(() => new Set(graphMatches.map(node => node.id)), [graphMatches]);
  const graphEdges = useMemo(() => graph.edges.filter(edge =>
    visibleIds.has(edge.source) && visibleIds.has(edge.target)), [graph, visibleIds]);
  const nodes = useMemo(() => visualNodes(graphMatches, graphEdges, direction),
    [graphMatches, graphEdges, direction]);
  const edges: Edge[] = useMemo(() => graphEdges.map((edge, i) => ({
    id: "link-" + i, source: edge.source, target: edge.target,
    type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed, color: "#9484d6" },
    style: { stroke: edge.kind === "namespace" ? "#d49ac6" : "#9484d6", strokeWidth: 1.8 }
  })), [graphEdges]);

  const selectedDir = selected?.startsWith("dir:") ? selected.slice(4) : null;
  const directoryFiles = selectedDir ? analysis.nodes.filter(node => node.directory === selectedDir) : [];
  const current = analysis.nodes.find(node => node.id === selected);
  const sourceContent = files.find(file => file.path === selected)?.content;

  const onFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList) return;
    try {
      const parsed = await readFiles(fileList);
      if (!parsed.length) throw new Error("No supported source files found in this folder.");
      setFiles(parsed);
      setSource(fileList[0]?.webkitRelativePath.split("/")[0] || "Local project");
      setSelected(null); setQuery(""); setError(""); setImportReport(null);
      scrollTo("architecture");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not read your folder.");
    }
    if (fileInput.current) fileInput.current.value = "";
  }, []);

  const onImported = useCallback((result: GitHubImportResult) => {
    setFiles(result.files);
    setSource(result.fullName);
    setSelected(null); setQuery(""); setError(""); setImportReport(result);
  }, []);

  function loadDemo() {
    setFiles(demoFiles); setSource("Example repository"); setSelected(null);
    setQuery(""); setError(""); setImportReport(null);
    scrollTo("architecture");
  }

  async function exportSelected() {
    setExporting(true); setError("");
    try {
      await downloadGraph({ nodes: graphMatches, edges: graphEdges, unresolved: analysis.unresolved },
        exportFormat, direction);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not export the graph.");
    } finally { setExporting(false); }
  }

  return <div className="app" id="top">
    <div className="ambient ambient-blue" aria-hidden="true" />
    <div className="ambient ambient-rose" aria-hidden="true" />
    <div className="ambient ambient-violet" aria-hidden="true" />

    <div className="site-shell">
      <header className="topbar liquid-panel">
        <a className="brand" href="#top" aria-label="RepoLens AI home">
          <span className="brandmark"><Layers3 size={25} strokeWidth={2.1} /></span>
          <span>RepoLens <b>AI</b></span>
        </a>
        <nav className="nav-links" aria-label="Main navigation">
          <a href="#workspace">Product</a>
          <a href="#features">Features</a>
          <a href="#architecture">Explorer</a>
          <a href="https://github.com/amnansyahmi/RepoLens-AI#quick-start"
            target="_blank" rel="noopener noreferrer">Docs</a>
        </nav>
        <button className="gradient-button nav-cta" onClick={() => scrollTo("workspace")}>
          Get started <ArrowUpRight size={16} />
        </button>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-heading">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-glow" /> FREE · OPEN SOURCE · PRIVACY FIRST</div>
            <h1 id="hero-heading">See the architecture<br /><span>behind your code.</span></h1>
            <p className="hero-lead">Turn any public GitHub repository or local project into a beautiful, interactive dependency map. Explore the connections that matter.</p>
            <div className="hero-actions">
              <button className="gradient-button hero-main-button" onClick={() => {
                setInputMode("github"); scrollTo("workspace");
                window.setTimeout(() => document.getElementById("github-repository-url")?.focus(), 450);
              }}><Sparkles size={19} /> Analyze a repository <ArrowRight size={17} /></button>
              <button className="glass-button hero-demo-button" onClick={loadDemo}><Play size={17} fill="currentColor" /> See demo</button>
            </div>
            <div className="hero-proof"><ShieldCheck size={17} /><span>No signup. No code upload. No paid API required.</span></div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-halo art-halo-blue" />
            <div className="art-halo art-halo-pink" />
            <div className="art-card art-card-back" />
            <div className="art-card art-card-mid" />
            <div className="art-card art-card-front">
              <span className="art-layer layer-one" />
              <span className="art-layer layer-two" />
              <span className="art-layer layer-three" />
              <span className="art-glint" />
            </div>
          </div>
        </section>

        <section id="workspace" className="import-panel liquid-panel" aria-label="Import a repository">
          <div className="import-head">
            <div className="segmented" role="group" aria-label="Repository source">
              <button className={inputMode === "github" ? "active" : ""}
                aria-pressed={inputMode === "github"} disabled={remoteBusy}
                onClick={() => setInputMode("github")}><Github size={19} /> GitHub repository</button>
              <button className={inputMode === "local" ? "active" : ""}
                aria-pressed={inputMode === "local"} disabled={remoteBusy}
                onClick={() => setInputMode("local")}><FolderOpen size={19} /> Local folder</button>
            </div>
            <span className="import-privacy"><ShieldCheck size={15}/> Your code stays yours</span>
          </div>
          <input ref={fileInput} className="sr-only" aria-label="Choose a project folder" type="file"
            multiple webkitdirectory="" directory=""
            onChange={event => void onFiles(event.target.files)} />
          {inputMode === "github" ? (
            <GitHubImport onImported={onImported} onBusyChange={setRemoteBusy} />
          ) : (
            <div className="local-import">
              <div><FolderOpen size={22} /><span><strong>Choose a project from your computer</strong><small>JavaScript, TypeScript and C# supported · Up to 400 files</small></span></div>
              <button className="gradient-button" onClick={() => fileInput.current?.click()}>
                <FolderOpen size={17} /> Browse folder
              </button>
            </div>
          )}
          {error && <div className="github-feedback github-error global-error" role="alert">
            <span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X size={16}/></button>
          </div>}
        </section>

        <section className="architecture-panel liquid-panel" id="architecture" aria-labelledby="architecture-heading">
          <div className="section-header">
            <div className="section-title-group">
              <span className="section-icon"><Network size={24}/></span>
              <span><h2 id="architecture-heading">Architecture diagram</h2>
                <p>Interactive overview of your repository</p></span>
            </div>
            <div className="view-switch" role="group" aria-label="Graph view">
              <button className={graphMode === "files" && !explorerOpen ? "active" : ""}
                aria-pressed={graphMode === "files" && !explorerOpen}
                onClick={() => { setGraphMode("files"); setExplorerOpen(false); }}>
                <Network size={16} /> Graph</button>
              <button className={graphMode === "directories" && !explorerOpen ? "active" : ""}
                aria-pressed={graphMode === "directories" && !explorerOpen}
                onClick={() => { setGraphMode("directories"); setExplorerOpen(false); }}>
                <Layers3 size={16} /> Layers</button>
              <button className={explorerOpen ? "active" : ""} aria-pressed={explorerOpen}
                onClick={() => setExplorerOpen(value => !value)}><Grid2X2 size={16} /> Modules</button>
            </div>
          </div>
          <div className="repository-caption">
            <div className="repo-label"><GitBranch size={15}/><strong title={source}>{source}</strong><span className="badge-small">{analysis.nodes.length} files</span></div>
            <div className="graph-filters">
              <label className="graph-search"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)}
                placeholder="Find a module…" aria-label="Search source modules" /></label>
              <label className="sr-only" htmlFor="layout-direction">Graph orientation</label>
              <select id="layout-direction" className="graph-select" value={direction}
                onChange={event => setDirection(event.target.value as LayoutDirection)}>
                <option value="LR">Left to right</option><option value="TB">Top to bottom</option>
              </select>
            </div>
          </div>
          {importReport && <div className={"github-report " + (importReport.partial ? "partial" : "complete")} role="status">
            <span><Github size={15} /> Imported {importReport.files.length} files from <b>{importReport.fullName}</b> · {importReport.branch}</span>
            <a href={importReport.url} target="_blank" rel="noopener noreferrer">View repository <ArrowUpRight size={14}/></a>
            {importReport.partial && <p>Partial analysis: {importReport.skipped} files skipped and {importReport.failed} failed. Some relationships may be missing.</p>}
            {importReport.usedApiFallback && <p>Source downloaded via GitHub's public API fallback; rate limits apply.</p>}
          </div>}
          <div className="graph-stage">
            <ReactFlow key={source + query + graphMode + direction} nodes={nodes} edges={edges}
              onNodeClick={(_, node) => setSelected(node.id)} fitView fitViewOptions={{ padding: 0.18 }}
              minZoom={0.14} maxZoom={2} nodesDraggable nodesConnectable={false} elementsSelectable
              proOptions={{ hideAttribution: false }}>
              <Background color="#c8c4e8" gap={24} size={1}/>
              <Controls showInteractive={false} position="bottom-left"/>
              <MiniMap nodeColor="#aabdf5" maskColor="#f7f1ffbb" pannable zoomable position="bottom-right"/>
            </ReactFlow>
            {analyzing && <div className="analysis-indicator"><span className="spinner-dot" /> Analyzing imports…</div>}
          </div>
          {explorerOpen && <div className="file-explorer">
            <div><strong>Files in this repository</strong><span>{fileMatches.length} matching</span></div>
            <div className="file-list">
              {fileMatches.map(node => <button key={node.id} title={node.id}
                onClick={() => setSelected(node.id)}>
                <FileCode2 size={16}/><span>{node.label}<small>{node.directory}</small></span><ArrowUpRight size={14}/></button>)}
              {!fileMatches.length && <p>No matching modules.</p>}
            </div>
          </div>}
          <div className="graph-footer">
            <span><span className="legend-dot"/> Internal references · Click nodes to inspect</span>
            <span>{nodes.length} nodes · {graphEdges.length} links · {analysis.unresolved} unresolved</span>
          </div>

          <div className="stats-grid" id="features">
            <StatCard icon={FolderOpen} label="Source files" value={analysis.nodes.length.toLocaleString()} tone="blue"/>
            <StatCard icon={Layers3} label="Dependencies" value={analysis.edges.length.toLocaleString()} tone="violet"/>
            <StatCard icon={Code2} label="Languages" value={insights.languages.length.toLocaleString()} tone="peach"/>
            <StatCard icon={GitBranch} label="Cycles detected" value={insights.cycles.length.toLocaleString()} tone="pink"/>
          </div>
          {semanticWarning && <div className="analysis-warning" role="status">{semanticWarning}</div>}
          {insights.cycles.length > 0 && <div className="analysis-warning">
            <strong>Possible circular dependencies:</strong> {insights.cycles.slice(0,3)
              .map(group => group.map(path => path.split("/").pop()).join(" → ")).join(" · ")}
          </div>}
        </section>

        <section className="lower-grid" aria-label="Analysis tools">
          <LocalAI analysis={analysis}/>
          <div className="export-panel liquid-panel">
            <div className="section-title-group">
              <span className="section-icon"><ArrowDownToLine size={24}/></span>
              <span><h2>Export diagram</h2><p>Share or reuse your architecture anywhere.</p></span>
            </div>
            <div className="export-options" role="group" aria-label="Export format">
              {formats.map(item => <button key={item.id}
                className={"export-option " + (exportFormat === item.id ? "selected" : "")}
                aria-pressed={exportFormat === item.id}
                onClick={() => setExportFormat(item.id)}>
                {exportFormat === item.id && <span className="selected-tick"><Check size={11}/></span>}
                <item.icon size={25} strokeWidth={1.6}/><strong>{item.label}</strong><small>{item.detail}</small>
              </button>)}
            </div>
            <button className="gradient-button export-action"
              disabled={exporting || nodes.length === 0} onClick={() => void exportSelected()}>
              <ArrowDownToLine size={19}/>{exporting ? "Exporting…" : "Export diagram"}
            </button>
            <p className="export-note">Only graph metadata is exported, never source code.</p>
          </div>
        </section>

        <section className="insights-panel liquid-panel" aria-label="Repository insights">
          <div className="insights-heading">
            <div className="section-title-group"><span className="section-icon"><Layers3 size={23}/></span>
              <span><h2>Codebase insights</h2><p>Useful signals from your dependency map.</p></span></div>
            <button className="insights-help" onClick={() => setShowInfo(value => !value)}
              aria-expanded={showInfo}><CircleHelp size={17}/> How it works</button>
          </div>
          {showInfo && <p className="insights-note">RepoLens parses JS/TS imports and estimates C# project/namespace links in your browser. Cycles and entrypoints are structural hints, not proof of runtime behavior. Local AI is optional.</p>}
          <div className="insights-metrics">
            <div><strong>{insights.entrypoints.length}</strong><span>Potential entrypoints</span></div>
            <div><strong>{insights.isolated.length}</strong><span>Unconnected files</span></div>
            <div><strong>{analysis.unresolved}</strong><span>Unresolved references</span></div>
            <div><strong>{insights.hubs[0]?.count ?? 0}</strong><span>Most incoming links</span></div>
          </div>
          {insights.hubs.length > 0 && <div className="top-modules"><span>Most referenced:</span>
            {insights.hubs.slice(0,3).map(hub => <button key={hub.id} onClick={() => setSelected(hub.id)}>
              {hub.id.split("/").pop()} <b>{hub.count}</b></button>)}
          </div>}
        </section>

        <footer className="footer">
          <div className="footer-pill"><Sparkles size={19}/><span><strong>Instant visualization</strong><small>From code to graph, in your browser</small></span></div>
          <div className="footer-pill"><ShieldCheck size={19}/><span><strong>Privacy first</strong><small>Local projects stay on your device</small></span></div>
          <div className="footer-pill"><ArrowDownToLine size={19}/><span><strong>Multiple exports</strong><small>PNG, SVG, Mermaid and JSON</small></span></div>
          <div className="footer-bottom"><a href="#top">RepoLens AI</a><span>Open source by <a href="https://github.com/amnansyahmi" target="_blank" rel="noopener noreferrer">Amnansyahmi</a></span>
            <a href="https://github.com/amnansyahmi/RepoLens-AI" target="_blank" rel="noopener noreferrer"><Github size={16}/> GitHub</a></div>
        </footer>
      </main>
    </div>

    {selected && <div className="detail-backdrop" role="presentation" onMouseDown={() => setSelected(null)}>
      <aside className="detail-panel liquid-panel" role="dialog" aria-modal="true" aria-label="File details"
        onMouseDown={event => event.stopPropagation()}>
        <div className="detail-head"><strong>File details</strong>
          <button aria-label="Close file details" onClick={() => setSelected(null)}><X size={20}/></button></div>
        <div className="detail-body">
          <div className="detail-icon"><FileCode2 size={27}/></div>
          <h2>{current?.label || selectedDir}</h2><p className="file-path">{selected}</p>
          <div className="detail-stats">
            <span>{current?.lines ?? (selectedDir ? directoryFiles.reduce((n,f) => n + f.lines, 0) : 0)} lines</span>
            <span>{selectedDir ? directoryFiles.length + " files" : analysis.edges.filter(e => e.target === selected).length + " incoming"}</span>
            <span>{analysis.edges.filter(e => e.source === selected).length} outgoing</span>
          </div>
          <h3>{selectedDir ? "Directory files" : "Source preview"}</h3>
          {selectedDir ? <div className="directory-detail">
            {directoryFiles.map(file => <button key={file.id} onClick={() => setSelected(file.id)}>
              <FileCode2 size={15}/>{file.label}</button>)}
          </div> : <pre><code>{sourceContent || "No source preview available"}</code></pre>}
        </div>
      </aside>
    </div>}
  </div>;
}

declare module "react" { interface InputHTMLAttributes<T> { webkitdirectory?: string; directory?: string } }
