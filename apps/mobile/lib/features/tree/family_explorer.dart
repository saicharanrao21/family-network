import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import 'graph_models.dart';

const _forest = Color(0xFF234F3D);
const _cream = Color(0xFFF8F4EC);
const _gold = Color(0xFFC5A45D);
const _ink = Color(0xFF17221D);
const _muted = Color(0xFF718078);

class FamilyExplorerScreen extends StatefulWidget {
  final ApiClient api;
  const FamilyExplorerScreen({required this.api, super.key});
  @override
  State<FamilyExplorerScreen> createState() => _FamilyExplorerScreenState();
}

class _FamilyExplorerScreenState extends State<FamilyExplorerScreen> {
  FamilyGraph? graph;
  bool loading = true;
  String? error;
  double zoom = 1;
  Offset pan = Offset.zero;
  String? selected;
  int depth = 2;
  final search = TextEditingController();

  String? personId;
  @override
  void initState() {
    super.initState();
    _resolveAndLoad();
  }

  Future<void> _resolveAndLoad() async {
    personId = await widget.api.currentPersonId();
    await _load();
  }

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (personId == null || personId!.isEmpty) {
      setState(() {
        loading = false;
        error = 'No family identity is linked to this account yet.';
      });
      return;
    }
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final result = await widget.api.getGraph(personId!, depth: depth);
      setState(() {
        graph = FamilyGraph.fromJson(result);
        selected = personId;
        loading = false;
      });
    } catch (_) {
      setState(() {
        loading = false;
        error =
            'We could not load your family graph. Check your connection and try again.';
      });
    }
  }

  void _select(String id) => setState(() => selected = id);
  Future<void> _focusSelected() async {
    if (selected == null) return;
    personId = selected;
    depth = 2;
    await _load();
  }

  void _resetView() => setState(() {
        zoom = 1;
        pan = Offset.zero;
      });

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Scaffold(
          backgroundColor: _cream,
          body: Center(child: CircularProgressIndicator()));
    }
    if (error != null) {
      return Scaffold(
          backgroundColor: _cream,
          appBar: AppBar(title: const Text('Family Explorer')),
          body: _EmptyGraph(message: error!, onRetry: _load));
    }
    final g = graph!;
    return Scaffold(
      backgroundColor: _cream,
      appBar: AppBar(
          backgroundColor: Colors.transparent,
          title: const Text('Family Explorer',
              style: TextStyle(fontWeight: FontWeight.w800)),
          actions: [
            IconButton(
                onPressed: () => setState(() {
                      zoom = (zoom * 1.25).clamp(.45, 3.5);
                    }),
                icon: const Icon(Icons.add)),
            IconButton(
                onPressed: () => setState(() {
                      zoom = (zoom * .8).clamp(.45, 3.5);
                    }),
                icon: const Icon(Icons.remove)),
            IconButton(
                onPressed: _resetView,
                icon: const Icon(Icons.center_focus_strong)),
          ]),
      body: Stack(children: [
        GestureDetector(
          onScaleUpdate: (d) => setState(() {
            pan += d.focalPointDelta;
            zoom = (zoom * d.scale).clamp(.45, 3.5);
          }),
          onDoubleTap: _focusSelected,
          onTapUp: (details) {
            final box = context.findRenderObject() as RenderBox?;
            final local = box?.globalToLocal(details.globalPosition);
            if (local == null) return;
            final positions = _layout(
                g,
                Size(MediaQuery.of(context).size.width,
                    MediaQuery.of(context).size.height));
            final center = Offset(MediaQuery.of(context).size.width / 2,
                MediaQuery.of(context).size.height / 2 + 50);
            final tapped = positions.entries.firstWhere((e) {
              final p = center + (e.value - center) * zoom + pan;
              return (p - local).distance <= 54 * zoom;
            }, orElse: () => const MapEntry('', Offset(-9999, -9999)));
            if (tapped.key.isNotEmpty) _select(tapped.key);
          },
          child: ClipRect(
              child: CustomPaint(
                  painter: _FamilyGraphPainter(
                      graph: g,
                      zoom: zoom,
                      pan: pan,
                      selected: selected,
                      query: search.text),
                  child: const SizedBox.expand())),
        ),
        Positioned(
            left: 16,
            right: 16,
            top: 14,
            child: Row(children: [
              Expanded(
                  child: TextField(
                      controller: search,
                      onChanged: (_) => setState(() {}),
                      decoration: const InputDecoration(
                          hintText: 'Search people in this view…',
                          prefixIcon: Icon(Icons.search),
                          fillColor: Colors.white))),
              const SizedBox(width: 10),
              Material(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  child: PopupMenuButton<int>(
                      initialValue: depth,
                      onSelected: (v) {
                        depth = v;
                        _load();
                      },
                      itemBuilder: (_) => const [
                            PopupMenuItem(
                                value: 1, child: Text('Nearby family')),
                            PopupMenuItem(
                                value: 2, child: Text('Extended family')),
                            PopupMenuItem(value: 3, child: Text('Deep family')),
                            PopupMenuItem(value: 4, child: Text('Very deep'))
                          ],
                      child: const Padding(
                          padding: EdgeInsets.all(14),
                          child: Icon(Icons.layers_outlined, color: _forest))))
            ])),
        Positioned(
            left: 16,
            right: 16,
            bottom: 18,
            child: _GraphStatus(
                graph: g,
                selected: selected,
                onDepth: () {
                  depth = math.min(5, depth + 1).toInt();
                  _load();
                },
                onFocus: _focusSelected)),
      ]),
    );
  }
}

class _GraphStatus extends StatelessWidget {
  final FamilyGraph graph;
  final String? selected;
  final VoidCallback onDepth;
  final VoidCallback onFocus;
  const _GraphStatus(
      {required this.graph,
      required this.selected,
      required this.onDepth,
      required this.onFocus});
  @override
  Widget build(BuildContext context) => Row(children: [
        Expanded(
            child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: [
                      BoxShadow(
                          color: Colors.black.withValues(alpha: 0.08),
                          blurRadius: 18)
                    ]),
                child: Text(
                    '${graph.nodes.length} people • ${graph.edges.length} connections • depth ${graph.depth}',
                    style: const TextStyle(
                        color: _muted, fontWeight: FontWeight.w700)))),
        const SizedBox(width: 8),
        Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            child: InkWell(
                onTap: onFocus,
                borderRadius: BorderRadius.circular(18),
                child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    child: Text('Focus',
                        style: TextStyle(
                            color: _forest, fontWeight: FontWeight.w800))))),
        const SizedBox(width: 8),
        Material(
            color: _forest,
            borderRadius: BorderRadius.circular(18),
            child: InkWell(
                onTap: onDepth,
                borderRadius: BorderRadius.circular(18),
                child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 15, vertical: 12),
                    child: Text('Expand',
                        style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800)))))
      ]);
}

class _EmptyGraph extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _EmptyGraph({required this.message, required this.onRetry});
  @override
  Widget build(BuildContext context) => Center(
      child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.hub_outlined, size: 64, color: _forest),
            const SizedBox(height: 18),
            Text(message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: _muted, fontSize: 16)),
            const SizedBox(height: 18),
            FilledButton(onPressed: onRetry, child: const Text('Try again'))
          ])));
}

Map<String, Offset> _layout(FamilyGraph graph, Size size) {
  final adjacency = <String, List<String>>{};
  for (final n in graph.nodes) {
    adjacency[n.id] = [];
  }
  for (final e in graph.edges) {
    adjacency[e.source]?.add(e.target);
    adjacency[e.target]?.add(e.source);
  }
  final dist = <String, int>{graph.focusPersonId: 0};
  final q = <String>[graph.focusPersonId];
  while (q.isNotEmpty) {
    final cur = q.removeAt(0);
    for (final n in adjacency[cur] ?? const []) {
      if (!dist.containsKey(n)) {
        dist[n] = dist[cur]! + 1;
        q.add(n);
      }
    }
  }
  final buckets = <int, List<String>>{};
  for (final n in graph.nodes) {
    (buckets[dist[n.id] ?? graph.depth] ??= []).add(n.id);
  }
  final result = <String, Offset>{};
  final center = Offset(size.width / 2, size.height / 2 + 50);
  for (final entry in buckets.entries) {
    final d = entry.key;
    final ids = entry.value;
    final radius =
        d == 0 ? 0.0 : math.min(size.width, size.height) * (.17 + d * .10);
    for (var i = 0; i < ids.length; i++) {
      final angle = (i / math.max(1, ids.length)) * math.pi * 2 - math.pi / 2;
      result[ids[i]] =
          center + Offset(math.cos(angle) * radius, math.sin(angle) * radius);
    }
  }
  return result;
}

class _FamilyGraphPainter extends CustomPainter {
  final FamilyGraph graph;
  final double zoom;
  final Offset pan;
  final String? selected;
  final String query;
  _FamilyGraphPainter(
      {required this.graph,
      required this.zoom,
      required this.pan,
      required this.selected,
      required this.query});
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawColor(_cream, BlendMode.srcOver);
    final raw = _layout(graph, size);
    final center = Offset(size.width / 2, size.height / 2 + 50);
    Offset tx(Offset p) => center + (p - center) * zoom + pan;
    final positions = raw.map((k, v) => MapEntry(k, tx(v)));
    for (final e in graph.edges) {
      final a = positions[e.source], b = positions[e.target];
      if (a == null || b == null) continue;
      final delta = b - a;
      final distance = delta.distance;
      if (distance < 1) continue;
      final unit = delta / distance;
      final start = a + unit * (52 * zoom);
      final end = b - unit * (52 * zoom);
      final paint = Paint();
      paint.color =
          e.type.startsWith('UNION_') ? _gold : _forest.withValues(alpha: 0.25);
      paint.strokeWidth = e.type.startsWith('UNION_') ? 3 : 2;
      paint.style = PaintingStyle.stroke;
      final path = Path()
        ..moveTo(start.dx, start.dy)
        ..cubicTo(start.dx + (end.dx - start.dx) * .25, start.dy,
            start.dx + (end.dx - start.dx) * .75, end.dy, end.dx, end.dy);
      canvas.drawPath(path, paint);
      if (e.type.startsWith('UNION_')) {
        final mid = Offset((start.dx + end.dx) / 2, (start.dy + end.dy) / 2);
        final diamond = Path()
          ..moveTo(mid.dx, mid.dy - 5)
          ..lineTo(mid.dx + 5, mid.dy)
          ..lineTo(mid.dx, mid.dy + 5)
          ..lineTo(mid.dx - 5, mid.dy)
          ..close();
        canvas.drawPath(diamond, Paint()..color = _gold);
      }
    }

    for (final n in graph.nodes) {
      final p = positions[n.id];
      if (p == null) continue;
      final matches = query.trim().isEmpty ||
          n.name.toLowerCase().contains(query.trim().toLowerCase());
      final isSelected = n.id == selected;
      final r = 46.0 * zoom;
      final fill = isSelected
          ? _forest
          : (matches ? Colors.white : Colors.white.withValues(alpha: 0.45));
      canvas.drawCircle(p, r, Paint()..color = fill);
      final border = Paint();
      border.color = isSelected ? _gold : _forest.withValues(alpha: 0.20);
      border.style = PaintingStyle.stroke;
      border.strokeWidth = 2;
      canvas.drawCircle(p, r, border);
      final initials = n.name.trim().isEmpty
          ? '?'
          : n.name
              .trim()
              .split(RegExp(r'\s+'))
              .take(2)
              .map((x) => x.isEmpty ? '' : x.substring(0, 1).toUpperCase())
              .join();
      final tp = TextPainter(
          text: TextSpan(
            text: initials,
            style: TextStyle(
                color: isSelected ? Colors.white : _forest,
                fontWeight: FontWeight.w900,
                fontSize: math.max(10, 18 * zoom)),
          ),
          textDirection: TextDirection.ltr)
        ..layout();
      tp.paint(canvas, p - Offset(tp.width / 2, tp.height / 2));
      final label = TextPainter(
          text: TextSpan(
              text: n.name,
              style: TextStyle(
                  color: matches ? _ink : _muted,
                  fontSize: math.max(8, 11 * zoom),
                  fontWeight: FontWeight.w800)),
          textDirection: TextDirection.ltr)
        ..layout(maxWidth: 150 * zoom);
      label.paint(canvas, p + Offset(-label.width / 2, r + 5 * zoom));
    }
  }

  @override
  bool shouldRepaint(covariant _FamilyGraphPainter old) =>
      old.graph != graph ||
      old.zoom != zoom ||
      old.pan != pan ||
      old.selected != selected ||
      old.query != query;
}
