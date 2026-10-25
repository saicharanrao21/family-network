export function buildAdjacency(nodes, edges) {
  const adjacency = new Map(nodes.map(id => [id, []]));
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, []);
    adjacency.get(edge.source).push(edge.target);
    adjacency.get(edge.target).push(edge.source);
  }
  return adjacency;
}

export function shortestPath(nodes, edges, start, target) {
  if (start === target) return [start];
  const adjacency = buildAdjacency(nodes, edges);
  const queue = [start];
  const previous = new Map([[start, null]]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    for (const next of adjacency.get(current) ?? []) {
      if (previous.has(next)) continue;
      previous.set(next, current);
      if (next === target) {
        const path = [target];
        let cursor = target;
        while (previous.get(cursor) !== null) {
          cursor = previous.get(cursor);
          path.push(cursor);
        }
        return path.reverse();
      }
      queue.push(next);
    }
  }
  return [];
}

export function boundedTraversal(nodes, edges, start, depth) {
  const adjacency = buildAdjacency(nodes, edges);
  const distances = new Map([[start, 0]]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    const distance = distances.get(current);
    if (distance >= depth) continue;
    for (const next of adjacency.get(current) ?? []) {
      if (distances.has(next)) continue;
      distances.set(next, distance + 1);
      queue.push(next);
    }
  }
  return distances;
}
