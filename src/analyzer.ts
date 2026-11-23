export type SourceFile = { path: string; content: string };
export type ModuleNode = { id: string; label: string; directory: string; extension: string; lines: number; external: boolean };
export type DependencyEdge = { source: string; target: string; kind: "import" | "project" };
export type Analysis = { nodes: ModuleNode[]; edges: DependencyEdge[]; unresolved: number };
const supported = /\.(tsx?|jsx?|mjs|cjs|cs|csproj)$/i;
const extensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".cs", ".csproj"];
const normalize = (path: string) => {
  const parts: string[] = [];
  for (const part of path.replaceAll("\\", "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") { parts.pop(); continue; }
    parts.push(part);
  }
  return parts.join("/");
};
const dirname = (path: string) => path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
const basename = (path: string) => path.split("/").pop() || path;
export function analyze(files: SourceFile[]): Analysis {
  const fileMap = new Map<string, SourceFile>();
  for (const file of files) {
    const path = normalize(file.path);
    if (supported.test(path) && !/(^|\/)(node_modules|dist|build|\.git|bin|obj)(\/|$)/i.test(path)) fileMap.set(path, { path, content: file.content });
  }
  const nodes: ModuleNode[] = [...fileMap.values()].map(file => ({
    id: file.path, label: basename(file.path), directory: dirname(file.path) || "root",
    extension: (file.path.match(/\.[^.]+$/) || [""])[0].slice(1).toLowerCase(),
    lines: file.content.split(/\r?\n/).length, external: false
  }));
  const edges: DependencyEdge[] = [];
  const seen = new Set<string>();
  let unresolved = 0;
  function add(source: string, specifier: string, kind: "import" | "project") {
    if (!specifier.startsWith(".") && kind === "import") return; // external package is not a repo file
    const targetBase = normalize([dirname(source), specifier].filter(Boolean).join("/"));
    const candidates = [targetBase, ...extensions.map(ext => targetBase + ext), ...extensions.map(ext => targetBase + "/index" + ext)];
    const target = candidates.find(path => fileMap.has(path));
    if (!target) { unresolved++; return; }
    const key = source + "|" + target;
    if (source !== target && !seen.has(key)) { seen.add(key); edges.push({ source, target, kind }); }
  }
  for (const file of fileMap.values()) {
    if (/\.(tsx?|jsx?|mjs|cjs)$/i.test(file.path)) {
      // Lightweight static scanning: imports, re-exports, dynamic imports and require.
      const regex = /\b(?:import|export)\s+(?:[^;\r\n]*?\s+from\s+)?["\x27]([^"\x27\r\n]+)["\x27]|\b(?:require|import)\s*\(\s*["\x27]([^"\x27\r\n]+)["\x27]/g;
      for (const match of file.content.matchAll(regex)) add(file.path, match[1] || match[2], "import");
    }
    if (file.path.endsWith(".csproj")) {
      for (const match of file.content.matchAll(/<ProjectReference\s+Include=["']([^"']+)["']/gi)) add(file.path, match[1], "project");
    }
  }
  return { nodes, edges, unresolved };
}
export function summarize(analysis: Analysis) {
  const byDirectory = new Map<string, number>();
  for (const node of analysis.nodes) byDirectory.set(node.directory, (byDirectory.get(node.directory) || 0) + 1);
  const counts = new Map<string, number>();
  for (const edge of analysis.edges) counts.set(edge.target, (counts.get(edge.target) || 0) + 1);
  return {
    directories: [...byDirectory.entries()].sort((a, b) => b[1] - a[1]),
    mostImported: [...counts.entries()].sort((a, b) => b[1] - a[1]),
    totalLines: analysis.nodes.reduce((sum, node) => sum + node.lines, 0)
  };
}
