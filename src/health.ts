import type { Analysis } from "./analyzer";
import { architectureInsights } from "./graph";

export type Severity = "high" | "medium" | "low" | "info";
export type Finding = {
  id: string;
  title: string;
  severity: Severity;
  explanation: string;
  action: string;
  evidence: string[];
  fact: string;
};
export type Dimension = { id: string; label: string; score: number | null; why: string };
export type EngineeringReport = {
  source: string;
  partial: boolean;
  sampleSize: number;
  totalEdges: number;
  overall: number | null;
  dimensions: Dimension[];
  findings: Finding[];
  languages: { name: string; count: number; percentage: number }[];
  topModules: { path: string; inbound: number; outbound: number }[];
  caveats: string[];
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const sortBySeverity: Record<Severity, number> = { high: 0, medium: 1, low: 2, info: 3 };
const supportedLanguages: Record<string, string> = {
  ts: "TypeScript", tsx: "TypeScript", js: "JavaScript", jsx: "JavaScript",
  mjs: "JavaScript", cjs: "JavaScript", cs: "C#", csproj: "C# project"
};
function readableLanguage(extension: string) {
  return supportedLanguages[extension.toLowerCase()] ?? "Other";
}
function dimension(id: string, label: string, score: number | null, why: string): Dimension {
  return { id, label, score: score === null ? null : clamp(score), why };
}

export function buildEngineeringReport(
  analysis: Analysis,
  options: { source?: string; partial?: boolean } = {}
): EngineeringReport {
  const source = options.source || "Local repository";
  const partial = options.partial === true;
  const insights = architectureInsights(analysis);
  const nodes = analysis.nodes;
  const ids = new Set(nodes.map(node => node.id));
  const incoming = new Map(nodes.map(node => [node.id, 0]));
  const outgoing = new Map(nodes.map(node => [node.id, 0]));
  const referencedFolders = new Map<string, Set<string>>();
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  let crossFolder = 0;
  for (const edge of analysis.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) continue;
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1);
    const from = nodeMap.get(edge.source)!;
    const to = nodeMap.get(edge.target)!;
    if (from.directory !== to.directory) {
      crossFolder++;
      if (!referencedFolders.has(edge.source)) referencedFolders.set(edge.source, new Set());
      referencedFolders.get(edge.source)!.add(to.directory);
    }
  }
  const edges = analysis.edges.length;
  const unresolved = Math.max(0, analysis.unresolved);
  const maxInbound = Math.max(0, ...incoming.values());
  const big = nodes.filter(node => node.lines >= 300 && node.extension !== "csproj")
    .sort((a, b) => b.lines - a.lines);
  const hub = nodes.filter(node => (incoming.get(node.id) ?? 0) >= 4)
    .sort((a, b) => (incoming.get(b.id) ?? 0) - (incoming.get(a.id) ?? 0));
  const fanout = nodes.filter(node => (outgoing.get(node.id) ?? 0) >= 7)
    .sort((a, b) => (outgoing.get(b.id) ?? 0) - (outgoing.get(a.id) ?? 0));
  const bridges = [...referencedFolders.entries()]
    .filter(([, dirs]) => dirs.size >= 4).sort((a, b) => b[1].size - a[1].size);
  const relevantFiles = nodes.filter(node => node.extension !== "csproj");
  const longest = Math.max(0, ...relevantFiles.map(node => node.lines));

  const dimensions = [
    dimension("cycles", "Cycles", edges > 0 ? 100 - insights.cycles.length * 20 : null,
      "Deducts 20 points for each detected dependency cycle; this is a static import signal."),
    dimension("coupling", "Coupling", edges > 0 ? 100 - Math.max(0, maxInbound - 3) * 9 - Math.max(0, fanout.length) * 8 : null,
      "Penalizes concentrated incoming dependencies and files with 7+ outgoing references."),
    dimension("resolution", "Resolution", edges + unresolved > 0 ? 100 - 100 * unresolved / (edges + unresolved) : null,
      "Share of resolved local dependency references; package imports are not included."),
    dimension("fileSize", "File size", relevantFiles.length ? 100 - big.length * 12 - Math.max(0, longest - 600) / 60 : null,
      "Large-file heuristic: 300+ lines; this does not measure code complexity."),
    dimension("boundaries", "Boundaries", edges > 0 ? 100 - bridges.length * 14 - Math.max(0, crossFolder / edges - .7) * 40 : null,
      "Flags files spanning four or more target directories; cross-directory imports are not inherently bad.")
  ];
  const known = dimensions.filter(d => d.score !== null);
  const overall = edges > 0 && known.length >= 3 ? clamp(known.reduce((sum, item) => sum + item.score!, 0) / known.length) : null;
  const findings: Finding[] = [];
  insights.cycles.slice(0, 6).forEach((paths, i) => findings.push({
    id: "cycle-" + i, title: "Circular dependency between " + paths.length + " modules", severity: "high",
    fact: paths.length + " files in a strongly connected component",
    explanation: "These files import one another through a dependency cycle. This can complicate changes and initialization.",
    action: "Extract shared contracts or move the common dependency into a lower-level module.",
    evidence: paths.slice(0, 8)
  }));
  for (const node of hub.slice(0, 4)) {
    const count = incoming.get(node.id)!;
    findings.push({
      id: "hub:" + node.id, title: "Highly referenced module", severity: count >= 8 ? "medium" : "low",
      fact: count + " incoming references", evidence: [node.id],
      explanation: "Many files rely directly on this module, increasing its change impact. High fan-in can also be intentional.",
      action: "Review its public interface and keep it stable; split unrelated responsibilities if present."
    });
  }
  for (const node of fanout.slice(0, 3)) {
    findings.push({
      id: "fanout:" + node.id, title: "Broad dependency fan-out", severity: "medium",
      fact: outgoing.get(node.id) + " outgoing references", evidence: [node.id],
      explanation: "This module directly depends on several other modules. It may be an intended composition root.",
      action: "Check whether this file coordinates components or mixes unrelated responsibilities."
    });
  }
  for (const node of big.slice(0, 4)) {
    findings.push({
      id: "size:" + node.id, title: "Large source file", severity: node.lines >= 650 ? "medium" : "low",
      fact: node.lines + " lines (heuristic)", evidence: [node.id],
      explanation: "Large files can be harder to navigate, but size alone is not proof of poor design.",
      action: "Inspect for multiple responsibilities, then extract cohesive units where appropriate."
    });
  }
  for (const [path, dirs] of bridges.slice(0, 3)) findings.push({
    id: "boundary:" + path, title: "Cross-directory dependency hub", severity: "low",
    fact: "References " + dirs.size + " distinct directories", evidence: [path],
    explanation: "This module reaches across several directory boundaries, which may be intentional orchestration.",
    action: "Review layer ownership and consider explicit interfaces if boundaries are being bypassed."
  });
  if (unresolved > 0) findings.push({
    id: "unresolved", title: "Unresolved local references", severity: "medium",
    fact: unresolved + " unresolved references",
    explanation: "Some local module or project references could not be mapped. Missing files, aliases or sampling limits may contribute.",
    action: "Check missing files and path aliases; use local folder mode for a more complete snapshot.",
    evidence: []
  });
  if (partial) findings.push({
    id: "partial", title: "Repository sample is incomplete", severity: "info",
    fact: "Partial import", explanation: "Some source files were omitted due to size, count or network limits. Graph-based measurements may undercount relationships.",
    action: "For more comprehensive results, analyze the repository locally or select a smaller project.", evidence: []
  });
  const topModules = nodes.filter(node => (incoming.get(node.id) ?? 0) > 0)
    .sort((a, b) => (incoming.get(b.id) ?? 0) - (incoming.get(a.id) ?? 0))
    .slice(0, 6).map(node => ({ path: node.id, inbound: incoming.get(node.id)!, outbound: outgoing.get(node.id)! }));
  const langs = new Map<string, number>();
  for (const node of nodes) langs.set(readableLanguage(node.extension), (langs.get(readableLanguage(node.extension)) ?? 0) + 1);
  const languages = [...langs.entries()].map(([name, count]) => ({
    name, count, percentage: nodes.length ? Math.round(count / nodes.length * 100) : 0
  })).sort((a, b) => b.count - a.count);
  const caveats = [
    "Scores are transparent structural heuristics, not a security audit, maintainability certification or test coverage measurement.",
    "The graph represents detected imports, project references and approximate C# namespaces; it does not resolve runtime behavior.",
    "Low or high values can be misleading when the repository is small, partially imported or built with unsupported languages.",
    ...(partial ? ["This analysis used an incomplete repository sample."] : [])
  ];
  return {
    source, partial, sampleSize: nodes.length, totalEdges: edges, overall, dimensions,
    findings: findings.sort((a,b)=>sortBySeverity[a.severity]-sortBySeverity[b.severity] || a.id.localeCompare(b.id)),
    languages, topModules, caveats
  };
}
export function reportToMarkdown(report: EngineeringReport): string {
  const lines = [
    "# RepoLensa — Architecture evidence report",
    "", "**Repository:** " + report.source.replace(/[\r\n]/g," "), "",
    "**Structural signal score:** " + (report.overall ?? "N/A") + (report.overall===null?"":" / 100") +
      (report.partial ? " (partial sample)" : ""), "",
    "## Structural dimensions", "",
    ...report.dimensions.map(d => "- **" + d.label + ":** " + (d.score === null ? "N/A" : d.score + "/100") + " — " + d.why),
    "", "## Source evidence and recommendations", ""
  ];
  if (!report.findings.length) lines.push("No flagged structural patterns in the analyzed files.");
  for (const f of report.findings) {
    lines.push("### " + f.title, "", "**Severity:** " + f.severity + " | **Observed:** " + f.fact, "",
      f.explanation, "", "**Suggested next step:** " + f.action, "");
    if (f.evidence.length) lines.push("**Evidence:** " + f.evidence.map(p => "\`" + p.replace(/\`/g, "") + "\`").join(", "), "");
  }
  lines.push("## Language distribution", "",
    ...report.languages.map(l => "- " + l.name + ": " + l.count + " files (" + l.percentage + "%)"), "",
    "## Methodology and limitations", "", ...report.caveats.map(c=>"- "+c), "",
    "Generated in your browser from code graph metadata. No source text is included.", "");
  return lines.join("\n");
}
