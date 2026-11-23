import type { Analysis, ModuleNode } from "./analyzer";
import { layoutGraph, type LayoutDirection } from "./graph";
export type ExportFormat = "json" | "mermaid" | "svg" | "png";

function escapeXml(text: string) {
  return text.replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&apos;" })[char]!);
}
function displayLabel(node: ModuleNode) {
  return node.label.length > 40 ? node.label.slice(0, 37) + "…" : node.label;
}

export function toMermaid(analysis: Analysis): string {
  const indexes = new Map(analysis.nodes.map((node, i) => [node.id, "n" + i]));
  const lines = ["flowchart LR"];
  for (const node of analysis.nodes) {
    const label = node.label.replace(/[\r\n]/g," ").slice(0, 100);
    lines.push("  " + indexes.get(node.id) + "[" + JSON.stringify(label) + "]");
  }
  for (const edge of analysis.edges) {
    const source = indexes.get(edge.source);
    const target = indexes.get(edge.target);
    if (source && target) lines.push("  " + source + " --> " + target);
  }
  return lines.join("\n") + "\n";
}

/** Static, self-contained SVG; source code is never embedded. */
export function toSvg(analysis: Analysis, direction: LayoutDirection = "LR"): string {
  const positions = layoutGraph(analysis.nodes, analysis.edges, direction);
  const coords = new Map(positions.map(p => [p.id, p]));
  const maxX = Math.max(0, ...positions.map(p => p.x));
  const maxY = Math.max(0, ...positions.map(p => p.y));
  const width = Math.max(550, Math.ceil(maxX + 300));
  const height = Math.max(250, Math.ceil(maxY + 170));
  const lines = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">',
    '<rect width="100%" height="100%" fill="#101827"/>',
    '<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#819ac6"/></marker></defs>'
  ];
  for (const edge of analysis.edges) {
    const a = coords.get(edge.source);
    const b = coords.get(edge.target);
    if (!a || !b) continue;
    const fromX = direction === "LR" ? a.x + 240 : a.x + 120;
    const fromY = direction === "LR" ? a.y + 37 : a.y + 74;
    const toX = direction === "LR" ? b.x : b.x + 120;
    const toY = direction === "LR" ? b.y + 37 : b.y;
    lines.push('<path d="M' + fromX + ' ' + fromY + ' L' + toX + ' ' + toY +
      '" stroke="#819ac6" stroke-width="1.5" fill="none" marker-end="url(#arrow)"/>');
  }
  for (const node of analysis.nodes) {
    const pos = coords.get(node.id);
    if (!pos) continue;
    lines.push('<rect x="' + pos.x + '" y="' + pos.y + '" width="240" height="74" rx="12" fill="#1b2940" stroke="#4b6794"/>');
    lines.push('<text x="' + (pos.x+14) + '" y="' + (pos.y+30) +
      '" fill="#edf4ff" font-size="13" font-family="Arial, sans-serif">' + escapeXml(displayLabel(node)) + '</text>');
    lines.push('<text x="' + (pos.x+14) + '" y="' + (pos.y+51) +
      '" fill="#a4b8d9" font-size="10" font-family="Arial, sans-serif">' +
      escapeXml(node.extension === "folder" ? "directory" : node.directory.slice(0, 50)) + '</text>');
  }
  lines.push('</svg>');
  return lines.join("\n");
}

export function saveText(filename: string, contents: string, mime: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadGraph(analysis: Analysis, format: ExportFormat, direction: LayoutDirection) {
  if (format === "json") {
    saveText("repolens-architecture.json", JSON.stringify({ schemaVersion: 1, analysis }, null, 2), "application/json");
    return;
  }
  if (format === "mermaid") {
    saveText("repolens-architecture.mmd", toMermaid(analysis), "text/plain");
    return;
  }
  const svg = toSvg(analysis, direction);
  if (format === "svg") {
    saveText("repolens-architecture.svg", svg, "image/svg+xml");
    return;
  }
  const img = new Image();
  const data = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Your browser could not render the graph image."));
      img.src = data;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported by this browser.");
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Could not encode PNG export.");
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = "repolens-architecture.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  } finally {
    URL.revokeObjectURL(data);
  }
}
