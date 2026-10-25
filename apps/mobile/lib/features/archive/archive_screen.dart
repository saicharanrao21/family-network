import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../core/app_state.dart';

const archiveForest = Color(0xFF234F3D),
    archiveInk = Color(0xFF17221D),
    archiveMuted = Color(0xFF718078),
    archiveCream = Color(0xFFF8F4EC),
    archiveGold = Color(0xFFC5A45D);

class ArchiveScreen extends ConsumerStatefulWidget {
  const ArchiveScreen({super.key});
  @override
  ConsumerState<ArchiveScreen> createState() => _ArchiveScreenState();
}

class _ArchiveScreenState extends ConsumerState<ArchiveScreen>
    with SingleTickerProviderStateMixin {
  late final TabController tabs;
  bool loading = true;
  String error = '';
  Map<String, dynamic> overview = {};
  List<dynamic> memories = [], stories = [], events = [], documents = [];
  @override
  void initState() {
    super.initState();
    tabs = TabController(length: 4, vsync: this);
    load();
  }

  Future<void> load() async {
    setState(() => loading = true);
    try {
      final api = ref.read(apiProvider);
      final r = await Future.wait([
        api.archiveOverview(),
        api.memories(),
        api.stories(),
        api.events(),
        api.documents()
      ]);
      if (mounted) {
        setState(() {
          overview = r[0] as Map<String, dynamic>;
          memories = r[1] as List<dynamic>;
          stories = r[2] as List<dynamic>;
          events = r[3] as List<dynamic>;
          documents = r[4] as List<dynamic>;
          error = '';
        });
      }
    } catch (_) {
      if (mounted) setState(() => error = 'Archive could not be loaded.');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> addMemory() async {
    final t = TextEditingController(), d = TextEditingController();
    final ok = await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
                title: const Text('Add memory'),
                content: Column(mainAxisSize: MainAxisSize.min, children: [
                  TextField(
                      controller: t,
                      decoration: const InputDecoration(labelText: 'Title')),
                  TextField(
                      controller: d,
                      maxLines: 3,
                      decoration:
                          const InputDecoration(labelText: 'Description'))
                ]),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(c, false),
                      child: const Text('Cancel')),
                  FilledButton(
                      onPressed: () =>
                          Navigator.pop(c, t.text.trim().isNotEmpty),
                      child: const Text('Save'))
                ]));
    if (ok == true) {
      try {
        await ref
            .read(apiProvider)
            .createMemory(title: t.text.trim(), description: d.text.trim());
        await load();
      } catch (_) {}
    }
  }

  Future<void> addStory() async {
    final t = TextEditingController(), b = TextEditingController();
    final ok = await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
                title: const Text('Write family story'),
                content: Column(mainAxisSize: MainAxisSize.min, children: [
                  TextField(
                      controller: t,
                      decoration: const InputDecoration(labelText: 'Title')),
                  TextField(
                      controller: b,
                      maxLines: 7,
                      decoration: const InputDecoration(labelText: 'Story'))
                ]),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(c, false),
                      child: const Text('Cancel')),
                  FilledButton(
                      onPressed: () => Navigator.pop(c,
                          t.text.trim().isNotEmpty && b.text.trim().isNotEmpty),
                      child: const Text('Save'))
                ]));
    if (ok == true) {
      try {
        await ref
            .read(apiProvider)
            .createStory(title: t.text.trim(), body: b.text.trim());
        await load();
      } catch (_) {}
    }
  }

  Future<void> addEvent() async {
    final t = TextEditingController(), d = TextEditingController();
    final ok = await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
                title: const Text('Add family event'),
                content: Column(mainAxisSize: MainAxisSize.min, children: [
                  TextField(
                      controller: t,
                      decoration:
                          const InputDecoration(labelText: 'Event title')),
                  TextField(
                      controller: d,
                      decoration: const InputDecoration(
                          labelText: 'Date/time ISO 8601'))
                ]),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(c, false),
                      child: const Text('Cancel')),
                  FilledButton(
                      onPressed: () => Navigator.pop(c,
                          t.text.trim().isNotEmpty && d.text.trim().isNotEmpty),
                      child: const Text('Save'))
                ]));
    if (ok == true) {
      try {
        await ref
            .read(apiProvider)
            .createEvent(title: t.text.trim(), startsAt: d.text.trim());
        await load();
      } catch (_) {}
    }
  }

  @override
  Widget build(BuildContext c) => Scaffold(
      backgroundColor: archiveCream,
      appBar: AppBar(
          backgroundColor: archiveCream,
          title: const Text('Family Archive',
              style: TextStyle(fontWeight: FontWeight.w800, color: archiveInk)),
          actions: [
            IconButton(onPressed: load, icon: const Icon(Icons.refresh))
          ],
          bottom: TabBar(
              controller: tabs,
              labelColor: archiveForest,
              unselectedLabelColor: archiveMuted,
              indicatorColor: archiveForest,
              tabs: const [
                Tab(text: 'Memories'),
                Tab(text: 'Stories'),
                Tab(text: 'Events'),
                Tab(text: 'Archive')
              ])),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error.isNotEmpty
              ? Center(child: Text(error))
              : TabBarView(controller: tabs, children: [
                  _tab(memories, Icons.photo_library_outlined, 'Memories',
                      addMemory),
                  _tab(stories, Icons.auto_stories_outlined, 'Stories',
                      addStory),
                  _tab(events, Icons.event_outlined, 'Events', addEvent),
                  _tab(documents, Icons.folder_outlined, 'Documents', null)
                ]));
  Widget _tab(List<dynamic> data, IconData icon, String label,
          Future<void> Function()? add) =>
      RefreshIndicator(
          onRefresh: load,
          child: ListView(padding: const EdgeInsets.all(18), children: [
            Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                    color: archiveForest,
                    borderRadius: BorderRadius.circular(24)),
                child: Row(children: [
                  Expanded(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                        Text('${data.length}',
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 30,
                                fontWeight: FontWeight.w900)),
                        Text(label,
                            style: const TextStyle(color: Colors.white70))
                      ])),
                  if (add != null)
                    FilledButton(
                        style: FilledButton.styleFrom(
                            backgroundColor: archiveGold,
                            foregroundColor: archiveInk),
                        onPressed: add,
                        child: const Text('Add'))
                ])),
            const SizedBox(height: 16),
            if (data.isEmpty)
              Card(
                  child: Padding(
                      padding: const EdgeInsets.all(28),
                      child: Column(children: [
                        Icon(icon, size: 42, color: archiveForest),
                        const SizedBox(height: 10),
                        Text('No $label yet',
                            style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                color: archiveInk)),
                        const SizedBox(height: 6),
                        const Text(
                            'Keep the moments and history that matter to your family.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: archiveMuted))
                      ])))
            else
              ...data.map((x) => Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: ListTile(
                      leading: CircleAvatar(
                          backgroundColor: const Color(0xFFE6EFEA),
                          child: Icon(icon, color: archiveForest)),
                      title: Text(x['title'] ?? 'Untitled'),
                      subtitle: Text(
                          (x['description'] ??
                                  x['body'] ??
                                  x['startsAt'] ??
                                  x['type'] ??
                                  'Family archive')
                              .toString(),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis))))
          ]));
  @override
  void dispose() {
    tabs.dispose();
    super.dispose();
  }
}
