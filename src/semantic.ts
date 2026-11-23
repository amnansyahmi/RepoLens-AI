/**
 * RepoLens semantic analyzer. JavaScript / TypeScript dependencies use the
 * TypeScript compiler's syntax tree, avoiding false positives from comments.
 *
 * C# namespace relationships remain heuristic; a browser-only tool cannot
 * perform the Roslyn compilation and symbol resolution required for
 * full C# class/type dependency graphs.
 */
import * as ts from "typescript";
import { analyze, type Analysis, type DependencyEdge, type SourceFile } from "./analyzer";

const jsSource = /\.(tsx?|jsx?|mjs|cjs)$/i;
const csSource = /\.cs$/i;
const extensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".cs", ".csproj", ".d.ts"];
const normalize = (input: string): string => {
  const result: string[] = [];
  for (const part of input.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") { result.pop(); continue; }
    result.push(part);
  }
  return result.join("/");
};
const dirname = (path: string) => path.slice(0, path.lastIndexOf("/") + 1).replace(/\/$/, "");
const within = (file: string, dir: string) => !dir || file.startsWith(dir + "/");

type ProjectConfig = {
  dir: string;
  baseUrl: string;
  paths: Record<string, string[]>;
};

function loadConfigs(files: SourceFile[]): ProjectConfig[] {
  const configs: ProjectConfig[] = [];
  for (const file of files) {
    if (!/(^|\/)(?:tsconfig|jsconfig)\.json$/i.test(file.path)) continue;
    const parsed = ts.parseConfigFileTextToJson(file.path, file.content);
    if (parsed.error || typeof parsed.config !== "object" || parsed.config === null) continue;
    const compiler = parsed.config.compilerOptions ?? {};
    const dir = dirname(normalize(file.path));
    const baseUrl = normalize([dir, typeof compiler.baseUrl === "string" ? compiler.baseUrl : "."].join("/"));
    const paths: Record<string, string[]> = {};
    if (compiler.paths && typeof compiler.paths === "object") {
      for (const [key, values] of Object.entries(compiler.paths)) {
        if (Array.isArray(values)) paths[key] = values.filter((v): v is string => typeof v === "string");
      }
    }
    configs.push({ dir, baseUrl, paths });
  }
  return configs.sort((a, b) => b.dir.length - a.dir.length);
}

function getStaticImports(file: SourceFile): string[] {
  const source = ts.createSourceFile(file.path, file.content, ts.ScriptTarget.Latest, true);
  const imports = new Set<string>();
  const add = (node: ts.Node | undefined) => {
    if (node && ts.isStringLiteralLike(node)) imports.add(node.text);
  };
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      add(node.moduleSpecifier);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      add(node.moduleReference.expression);
    } else if (ts.isCallExpression(node) && node.arguments.length === 1) {
      if ((ts.isIdentifier(node.expression) && node.expression.text === "require") ||
          node.expression.kind === ts.SyntaxKind.ImportKeyword) add(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return [...imports];
}

export function analyzeSemantically(files: SourceFile[]): Analysis {
  const basic = analyze(files);
  const available = new Set(basic.nodes.map(node => node.id));
  const sourceFiles = new Map<string, SourceFile>(files.map(file => [normalize(file.path), file]));
  const configs = loadConfigs(files);
  const edges: DependencyEdge[] = basic.edges.filter(edge => edge.kind === "project");
  const seen = new Set(edges.map(edge => edge.source + "\0" + edge.target));
  let unresolved = 0;
  function push(source: string, target: string, kind: DependencyEdge["kind"]) {
    if (source === target || !available.has(target)) return;
    const key = source + "\0" + target;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ source, target, kind });
  }
  function resolve(base: string): string | null {
    const candidate = normalize(base);
    for (const path of [candidate, ...extensions.map(ext => candidate + ext),
      ...extensions.map(ext => candidate + "/index" + ext)]) {
      if (available.has(path)) return path;
    }
    return null;
  }
  function resolveImport(source: string, spec: string): string | null | undefined {
    if (spec.startsWith(".")) return resolve(dirname(source) + "/" + spec);
    const config = configs.find(item => within(source, item.dir));
    if (!config) return undefined;
    for (const [pattern, targets] of Object.entries(config.paths)) {
      const wildcard = pattern.indexOf("*");
      const head = wildcard < 0 ? pattern : pattern.slice(0, wildcard);
      const tail = wildcard < 0 ? "" : pattern.slice(wildcard + 1);
      const matches = wildcard < 0 ? spec === pattern : spec.startsWith(head) && spec.endsWith(tail);
      if (!matches) continue;
      const middle = wildcard < 0 ? "" : spec.slice(head.length, spec.length - tail.length);
      for (const target of targets) {
        const match = resolve(config.baseUrl + "/" + target.replace("*", middle));
        if (match) return match;
      }
      return null; // recognized alias but missing file
    }
    // Only regard baseUrl-relative imports as internal when they actually resolve.
    return resolve(config.baseUrl + "/" + spec) ?? undefined;
  }

  for (const node of basic.nodes) {
    const file = sourceFiles.get(node.id);
    if (!file || !jsSource.test(node.id)) continue;
    for (const spec of getStaticImports(file)) {
      const target = resolveImport(node.id, spec);
      if (target) push(node.id, target, "import");
      else if (target === null) unresolved++;
    }
  }

  const namespaceFiles = new Map<string, Set<string>>();
  const namespaceOfFile = new Map<string, Set<string>>();
  for (const node of basic.nodes) {
    const file = sourceFiles.get(node.id);
    if (!file || !csSource.test(node.id)) continue;
    // Best-effort C# namespace recognition. The using parser below deliberately
    // limits itself to namespace declarations and avoids claiming type analysis.
    const namespaceNames = new Set<string>();
    const namespacePattern = /\bnamespace\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*(?:;|\{)/g;
    for (const match of file.content.matchAll(namespacePattern)) {
      namespaceNames.add(match[1]);
      if (!namespaceFiles.has(match[1])) namespaceFiles.set(match[1], new Set());
      namespaceFiles.get(match[1])!.add(node.id);
    }
    namespaceOfFile.set(node.id, namespaceNames);
  }
  for (const node of basic.nodes) {
    const file = sourceFiles.get(node.id);
    if (!file || !csSource.test(node.id)) continue;
    const own = namespaceOfFile.get(node.id) ?? new Set<string>();
    const references = new Set<string>();
    const pattern = /\b(?:global\s+)?using\s+(?!static\b)([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*;/g;
    for (const match of file.content.matchAll(pattern)) references.add(match[1]);
    for (const namespaceName of references) {
      if (own.has(namespaceName)) continue;
      const destinations = namespaceFiles.get(namespaceName);
      if (!destinations) continue; // framework or external reference
      for (const target of destinations) push(node.id, target, "namespace");
    }
  }
  // The base parser's unresolved count refers to imports we have re-parsed via
  // the AST, so only carry it for C# project references.
  const projectUnresolved = basic.nodes.some(node => node.extension === "csproj")
    ? countMissingProjectReferences(files, available)
    : 0;
  return { nodes: basic.nodes, edges, unresolved: unresolved + projectUnresolved };
}

function countMissingProjectReferences(files: SourceFile[], available: Set<string>): number {
  let count = 0;
  for (const file of files) {
    if (!/\.csproj$/i.test(file.path)) continue;
    for (const match of file.content.matchAll(/<ProjectReference\s+Include=["']([^"']+)["']/gi)) {
      const path = normalize(dirname(file.path) + "/" + match[1]);
      if (!available.has(path)) count++;
    }
  }
  return count;
}
