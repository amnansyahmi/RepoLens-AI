import type { SourceFile } from "./analyzer";
export const demoFiles: SourceFile[] = [
  {path:"src/main.tsx",content:"import App from './App';\nimport './styles';"},
  {path:"src/App.tsx",content:"import { Dashboard } from './features/dashboard';\nimport { Graph } from './features/graph';\nimport { getGraph } from './services/analysis';"},
  {path:"src/features/dashboard/index.ts",content:"export { Dashboard } from './Dashboard';"},
  {path:"src/features/dashboard/Dashboard.tsx",content:"import { getGraph } from '../../services/analysis';"},
  {path:"src/features/graph/index.ts",content:"export { Graph } from './Graph';"},
  {path:"src/features/graph/Graph.tsx",content:"import { getGraph } from '../../services/analysis';\nimport { arrange } from '../../lib/layout';"},
  {path:"src/services/analysis.ts",content:"import { parse } from '../lib/parser';\nimport { arrange } from '../lib/layout';"},
  {path:"src/lib/parser.ts",content:"export function parse() { return []; }"},
  {path:"src/lib/layout.ts",content:"export function arrange() { return []; }"},
  {path:"src/styles.ts",content:"export const theme = 'dark';"}
];
