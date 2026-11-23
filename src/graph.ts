import type { Analysis, DependencyEdge, ModuleNode } from "./analyzer";

export type GraphMode = "files" | "directories";
export type LayoutDirection = "LR" | "TB";

export function projectGraph(analysis: Analysis, mode: GraphMode): Analysis {
  if (mode === "files") return analysis;
  const folders = new Map<string, ModuleNode>();
  for (const file of analysis.nodes) {
    const key = "dir:" + file.directory;
    const existing = folders.get(key);
    if (existing) existing.lines += file.lines;
    else folders.set(key, {
      id: key, label: file.directory, directory: file.directory,
      extension: "folder", lines: file.lines, external: false
    });
  }
  const paths = new Map(analysis.nodes.map(node => [node.id, "dir:" + node.directory]));
  const edges: DependencyEdge[] = [];
  const unique = new Set<string>();
  for (const edge of analysis.edges) {
    const source = paths.get(edge.source);
    const target = paths.get(edge.target);
    if (!source || !target || source === target) continue;
    const key = source + "\0" + target;
    if (unique.has(key)) continue;
    unique.add(key);
    edges.push({ source, target, kind: edge.kind });
  }
  return { nodes: [...folders.values()], edges, unresolved: analysis.unresolved };
}

/** Hierarchical layout without a third-party graph engine or network call. */
export function layoutGraph(
  nodes: ModuleNode[], edges: DependencyEdge[], direction: LayoutDirection = "LR"
): Array<{ id: string; x: number; y: number }> {
  const ids = new Set(nodes.map(node => node.id));
  const incoming = new Map(nodes.map(node => [node.id, 0]));
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) continue;
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
  }
  const degree = new Map(incoming);
  const layer = new Map<string, number>();
  const queue = nodes.filter(node => (degree.get(node.id) ?? 0) === 0)
    .sort((a, b) => a.directory.localeCompare(b.directory) || a.label.localeCompare(b.label))
    .map(node => node.id);
  for (const id of queue) layer.set(id, 0);
  // Kahn layering; cycle nodes are placed into nearby fallback layers.
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head];
    for (const next of outgoing.get(id) ?? []) {
      layer.set(next, Math.max(layer.get(next) ?? 0, (layer.get(id) ?? 0) + 1));
      const n = (degree.get(next) ?? 0) - 1;
      degree.set(next, n);
      if (n === 0) queue.push(next);
    }
  }
  for (const node of nodes) {
    if (layer.has(node.id)) continue;
    const predecessors = edges.filter(edge => edge.target === node.id && layer.has(edge.source));
    const rank = predecessors.length
      ? Math.min(15, Math.max(...predecessors.map(edge => layer.get(edge.source) ?? 0)) + 1)
      : 0;
    layer.set(node.id, rank);
  }
  const groups = new Map<number, ModuleNode[]>();
  for (const node of nodes) {
    const rank = Math.min(layer.get(node.id) ?? 0, 15);
    groups.set(rank, [...(groups.get(rank) ?? []), node]);
  }
  const positions: Array<{ id: string; x: number; y: number }> = [];
  for (const [rank, group] of groups) {
    group.sort((a, b) => a.directory.localeCompare(b.directory) || a.label.localeCompare(b.label));
    group.forEach((node, index) => {
      const across = rank * 292;
      const down = index * 116;
      positions.push({ id: node.id, x: direction === "LR" ? across : down, y: direction === "LR" ? down : across });
    });
  }
  return positions;
}

export function architectureInsights(analysis: Analysis) {
  const ids = analysis.nodes.map(node => node.id);
  const neighbors = new Map(ids.map(id => [id, [] as string[]]));
  const inbound = new Map(ids.map(id => [id, 0]));
  const outbound = new Map(ids.map(id => [id, 0]));
  for (const edge of analysis.edges) {
    if (!neighbors.has(edge.source) || !neighbors.has(edge.target)) continue;
    neighbors.get(edge.source)!.push(edge.target);
    inbound.set(edge.target, inbound.get(edge.target)! + 1);
    outbound.set(edge.source, outbound.get(edge.source)! + 1);
  }
  const indices = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cycles: string[][] = [];
  let index = 0;
  const visit = (id: string) => {
    indices.set(id, index);
    low.set(id, index);
    index++;
    stack.push(id);
    onStack.add(id);
    for (const neighbor of neighbors.get(id) || []) {
      if (!indices.has(neighbor)) {
        visit(neighbor);
        low.set(id, Math.min(low.get(id)!, low.get(neighbor)!));
      } else if (onStack.has(neighbor)) {
        low.set(id, Math.min(low.get(id)!, indices.get(neighbor)!));
      }
    }
    if (low.get(id) === indices.get(id)) {
      const members: string[] = [];
      let node: string;
      do {
        node = stack.pop()!;
        onStack.delete(node);
        members.push(node);
      } while (node !== id);
      if (members.length > 1) cycles.push(members.sort());
    }
  };
  for (const id of ids) if (!indices.has(id)) visit(id);
  const isolated = ids.filter(id => !inbound.get(id) && !outbound.get(id));
  const entrypoints = ids.filter(id => !inbound.get(id) && (outbound.get(id) || 0) > 0);
  const hubs = ids.filter(id => inbound.get(id)! > 0)
    .sort((a, b) => inbound.get(b)! - inbound.get(a)!)
    .slice(0, 5).map(id => ({ id, count: inbound.get(id)! }));
  const languages = new Map<string, number>();
  for (const node of analysis.nodes) {
    const name = node.extension === "cs" || node.extension === "csproj" ? "C# / .NET" :
      ["ts", "tsx"].includes(node.extension) ? "TypeScript" :
      ["js", "jsx", "mjs", "cjs"].includes(node.extension) ? "JavaScript" : "Other";
    languages.set(name, (languages.get(name) ?? 0) + 1);
  }
  return { cycles, isolated, entrypoints, hubs, languages: [...languages.entries()].sort((a,b) => b[1]-a[1]) };
}
