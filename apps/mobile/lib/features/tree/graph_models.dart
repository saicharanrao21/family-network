class GraphNode {
  final String id;
  final String name;
  final String status;
  const GraphNode({required this.id, required this.name, required this.status});
  factory GraphNode.fromJson(Map<String, dynamic> json) => GraphNode(
        id: '${json['id']}',
        name: '${json['name'] ?? 'Unknown'}',
        status: '${json['status'] ?? 'UNKNOWN'}',
      );
}

class GraphEdge {
  final String id;
  final String source;
  final String target;
  final String type;
  const GraphEdge(
      {required this.id,
      required this.source,
      required this.target,
      required this.type});
  factory GraphEdge.fromJson(Map<String, dynamic> json) => GraphEdge(
        id: '${json['id']}',
        source: '${json['source']}',
        target: '${json['target']}',
        type: '${json['type']}',
      );
}

class FamilyGraph {
  final String focusPersonId;
  final int depth;
  final List<GraphNode> nodes;
  final List<GraphEdge> edges;
  const FamilyGraph(
      {required this.focusPersonId,
      required this.depth,
      required this.nodes,
      required this.edges});
  factory FamilyGraph.fromJson(Map<String, dynamic> json) => FamilyGraph(
        focusPersonId: '${json['focusPersonId']}',
        depth: (json['depth'] as num?)?.toInt() ?? 2,
        nodes: ((json['nodes'] as List?) ?? const [])
            .map((e) => GraphNode.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList(),
        edges: ((json['edges'] as List?) ?? const [])
            .map((e) => GraphEdge.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList(),
      );
}

class KinshipResult {
  final bool connected;
  final String? relation;
  final int? hops;
  final List<Map<String, dynamic>> path;
  const KinshipResult(
      {required this.connected,
      required this.relation,
      required this.hops,
      required this.path});
  factory KinshipResult.fromJson(Map<String, dynamic> json) => KinshipResult(
        connected: json['connected'] == true,
        relation: json['relation']?.toString(),
        hops: (json['hops'] as num?)?.toInt(),
        path: ((json['path'] as List?) ?? const [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList(),
      );
}
