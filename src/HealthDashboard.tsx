import { useMemo, useState } from "react";
import { Activity, ArrowDownToLine, ArrowUpRight, ChartNoAxesCombined, ChevronDown, Code2, FileCode2, ShieldAlert } from "lucide-react";
import type { EngineeringReport, Finding } from "./health";
import { reportToMarkdown } from "./health";
import { saveText } from "./export";

const palette = ["#5e7fea", "#b277df", "#ef9ab5", "#62b8c7", "#f2b977", "#84b89a"];
const severityLabel: Record<Finding["severity"],string> = {high:"High",medium:"Medium",low:"Low",info:"Info"};

function HealthRadar({ report }: {report:EngineeringReport}) {
  const dimensions=report.dimensions;
  const count=dimensions.length;
  const point=(i:number,r:number)=>{
    const angle=(i/count)*Math.PI*2-Math.PI/2;
    return [120+Math.cos(angle)*r, 120+Math.sin(angle)*r] as const;
  };
  const polygon=(r:number)=>dimensions.map((_,i)=>point(i,r).join(",")).join(" ");
  const coverage=dimensions.filter(d=>d.score!==null);
  const filled=coverage.length>=3
    ? dimensions.map((d,i)=>point(i,86*(d.score??0)/100).join(",")).join(" ")
    : "";
  return <svg viewBox="0 0 240 240" role="img"
    aria-label={"Structural radar: "+dimensions.map(d=>d.label+" "+(d.score??"not available")).join(", ")}>
    <defs><linearGradient id="radar-fill" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#70c1ff" stopOpacity=".6"/><stop offset="1" stopColor="#ad77db" stopOpacity=".33"/></linearGradient></defs>
    {[.25,.5,.75,1].map(r=><polygon key={r} points={polygon(r*86)} stroke="#c8c6e6" strokeWidth="1" fill="none"/>)}
    {dimensions.map((_,i)=>{const [x,y]=point(i,86);return <line key={i} x1="120" y1="120" x2={x} y2={y} stroke="#d9d2ed" strokeWidth="1"/>})}
    {filled&&<polygon points={filled} stroke="#647de6" strokeWidth="2.3" fill="url(#radar-fill)"/>}
    {dimensions.map((dim,i)=>{const [x,y]=point(i,101);return <text key={dim.id} x={x} y={y}
      textAnchor={x>134?"start":x<106?"end":"middle"} dominantBaseline="middle"
      fill="#586385" fontSize="9.5" fontWeight="650">{dim.label}</text>})}
    {dimensions.filter(d=>d.score!==null).map(d=>{const i=dimensions.indexOf(d);const [x,y]=point(i,86*d.score!/100);return <circle key={d.id} cx={x} cy={y} r="3.6" fill="#536ede" stroke="#fff" strokeWidth="1.6"/>})}
  </svg>;
}

function LanguageRing({ report }: {report:EngineeringReport}) {
  const total=report.languages.reduce((sum,item)=>sum+item.count,0);
  const r=54, circumference=2*Math.PI*r;
  let offset=0;
  return <div className="report-lang-layout">
    <svg viewBox="0 0 160 160" role="img" aria-label={"Files by language: "+report.languages.map(l=>l.name+" "+l.count).join(", ")}>
      <circle cx="80" cy="80" r={r} fill="none" stroke="#e5e3f2" strokeWidth="18"/>
      {report.languages.map((lang,i)=>{
        const part=total?lang.count/total:0;
        const start=offset;offset+=part;
        return <circle key={lang.name} cx="80" cy="80" r={r} fill="none" stroke={palette[i%palette.length]}
          strokeWidth="18" strokeDasharray={part*circumference+" "+circumference}
          strokeDashoffset={-start*circumference} transform="rotate(-90 80 80)"/>;
      })}
      <text x="80" y="76" textAnchor="middle" fill="#2c3455" fontSize="25" fontWeight="800">{total}</text>
      <text x="80" y="95" textAnchor="middle" fill="#8089a6" fontSize="11">files</text>
    </svg>
    <div className="report-lang-list">{report.languages.map((l,i)=><div key={l.name}>
      <span className="report-color" style={{background:palette[i%palette.length]}}/>
      <span>{l.name}</span><strong>{l.percentage}%</strong>
    </div>)}</div>
  </div>;
}

export default function HealthDashboard({
  report, onEvidence
}: {report:EngineeringReport;onEvidence:(path:string, trigger:HTMLButtonElement)=>void}) {
  const [severity,setSeverity]=useState<"all"|"high"|"medium"|"low"|"info">("all");
  const findings=useMemo(()=>report.findings.filter(f=>severity==="all"||f.severity===severity),[report, severity]);
  function exportReport(){saveText("repolensa-architecture-report.md",reportToMarkdown(report),"text/markdown;charset=utf-8")}
  return <section id="health" className="health-panel liquid-panel" aria-labelledby="health-heading">
    <div className="section-header health-header">
      <div className="section-title-group">
        <span className="section-icon"><ChartNoAxesCombined size={24}/></span>
        <span><h2 id="health-heading">Engineering health report</h2>
          <p>Findings grounded in measurable dependency-graph signals, not AI guesses.</p></span>
      </div>
      <button className="glass-button health-download" onClick={exportReport}><ArrowDownToLine size={17}/> Markdown report</button>
    </div>
    <div className="health-overview">
      <div className="health-score-card">
        <div className="health-score">{report.overall===null?"N/A":report.overall}<span>{report.overall===null?"":"/100"}</span></div>
        <strong>Structural signal score</strong>
        <p>Transparent heuristic based on the files analyzed. Not a security, test coverage, or code quality certification.</p>
        {report.partial&&<div className="health-partial"><ShieldAlert size={15}/> Partial import — scores may not reflect the full repository.</div>}
      </div>
      <div className="health-radar-card"><strong>Structural dimensions</strong><HealthRadar report={report}/></div>
      <div className="health-lang-card"><strong>Languages observed</strong><LanguageRing report={report}/></div>
    </div>
    <div className="health-dimensions">
      {report.dimensions.map(d=><div key={d.id}>
        <span>{d.label}</span><strong>{d.score===null?"N/A":d.score+"/100"}</strong>
        <div className="health-meter" role="meter" aria-label={d.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={d.score??0} aria-valuetext={d.score===null?"Not enough data":d.score+" out of 100"}>
          <span style={{width:(d.score??0)+"%"}}/>
        </div>
      </div>)}
    </div>
    <div className="report-findings-head">
      <div><h3>Evidence and improvements</h3><p>{report.findings.length} observations with practical next steps</p></div>
      <label>Severity <select value={severity} onChange={event=>setSeverity(event.target.value as typeof severity)}>
        <option value="all">All findings</option><option value="high">High</option><option value="medium">Medium</option>
        <option value="low">Low</option><option value="info">Info</option>
      </select></label>
    </div>
    <div className="report-finding-list">
      {findings.map(f=><article key={f.id} className="report-finding">
        <div className="finding-head"><span className={"finding-severity "+f.severity}>{severityLabel[f.severity]}</span>
          <strong>{f.title}</strong><span className="finding-metric">{f.fact}</span></div>
        <p>{f.explanation}</p><p className="finding-action"><Activity size={15}/> {f.action}</p>
        {!!f.evidence.length&&<div className="finding-files">{f.evidence.map(path=><button key={path}
          title={"Inspect "+path} onClick={event=>onEvidence(path, event.currentTarget)}><FileCode2 size={13}/><span>{path}</span><ArrowUpRight size={13}/></button>)}</div>}
      </article>)}
      {!findings.length&&<div className="health-empty">No matching findings in the analyzed files. This is not a guarantee of architectural quality.</div>}
    </div>
    <details className="health-method"><summary><Code2 size={15}/> How is this calculated? <ChevronDown size={15}/></summary>
      <p>RepoLensa uses observed dependency cycles, concentrated imports, unresolved references, file-size signals and broad cross-directory dependencies. All checks are deterministic and explain their thresholds.</p>
      {report.dimensions.map(d=><p key={d.id}><strong>{d.label}:</strong> {d.why}</p>)}
      {report.caveats.map((c,i)=><p key={i}>{c}</p>)}
    </details>
  </section>;
}
