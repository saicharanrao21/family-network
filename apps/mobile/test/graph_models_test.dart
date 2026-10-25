import 'package:flutter_test/flutter_test.dart';
import 'package:family_network/features/tree/graph_models.dart';

void main() {
  test('FamilyGraph parses nodes and edges safely', () {
    final graph = FamilyGraph.fromJson({
      'focusPersonId': 'p1',
      'depth': 3,
      'nodes': [
        {'id': 'p1', 'name': 'Parent', 'status': 'LIVING'},
        {'id': 'p2', 'name': 'Child', 'status': 'UNKNOWN'},
      ],
      'edges': [
        {
          'id': 'r1',
          'source': 'p1',
          'target': 'p2',
          'type': 'PARENT_BIOLOGICAL'
        },
      ],
    });
    expect(graph.focusPersonId, 'p1');
    expect(graph.depth, 3);
    expect(graph.nodes.length, 2);
    expect(graph.edges.single.type, 'PARENT_BIOLOGICAL');
  });

  test('malformed optional graph fields fall back safely', () {
    final graph = FamilyGraph.fromJson({'focusPersonId': 'p1'});
    expect(graph.depth, 2);
    expect(graph.nodes, isEmpty);
    expect(graph.edges, isEmpty);
  });
}
