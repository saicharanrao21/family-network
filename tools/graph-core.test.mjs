import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedTraversal, shortestPath } from './graph-core.mjs';

test('shortestPath returns the shortest connected route', () => {
  const nodes = ['a','b','c','d','e'];
  const edges = [{source:'a',target:'b'},{source:'b',target:'c'},{source:'a',target:'d'},{source:'d',target:'e'},{source:'e',target:'c'}];
  assert.deepEqual(shortestPath(nodes, edges, 'a', 'c'), ['a','b','c']);
});

test('shortestPath returns empty for disconnected people', () => {
  assert.deepEqual(shortestPath(['a','b'], [], 'a', 'b'), []);
});

test('boundedTraversal never exceeds requested depth', () => {
  const nodes = Array.from({length: 20}, (_, i) => String(i));
  const edges = nodes.slice(0,-1).map((id, i) => ({source:id,target:String(i+1)}));
  const result = boundedTraversal(nodes, edges, '0', 5);
  assert.equal(result.size, 6);
  assert.equal(result.get('5'), 5);
  assert.equal(result.has('6'), false);
});
