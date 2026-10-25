import { performance } from 'node:perf_hooks';
import { boundedTraversal, shortestPath } from './graph-core.mjs';

const count = Number(process.env.GRAPH_BENCHMARK_N ?? 10000);
const nodes = Array.from({length: count}, (_, i) => String(i));
const edges = nodes.slice(0, -1).map((id, i) => ({source:id, target:String(i + 1)}));
const start = performance.now();
const reachable = boundedTraversal(nodes, edges, '0', 25);
const traversalMs = performance.now() - start;
const pathStart = performance.now();
const path = shortestPath(nodes, edges, '0', String(count - 1));
const pathMs = performance.now() - pathStart;
console.log(JSON.stringify({ nodes: count, boundedDepth: 25, reachable: reachable.size, pathLength: path.length, traversalMs: Number(traversalMs.toFixed(2)), pathMs: Number(pathMs.toFixed(2)) }, null, 2));
const maxTraversal = Number(process.env.MAX_TRAVERSAL_MS ?? 250);
const maxPath = Number(process.env.MAX_PATH_MS ?? 750);
if (traversalMs > maxTraversal || pathMs > maxPath) process.exit(1);
