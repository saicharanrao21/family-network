import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/app_state.dart';

const _forest = Color(0xFF173C32);
const _cream = Color(0xFFF6F2E9);
const _muted = Color(0xFF6F756F);

class FamilyBuilderScreen extends ConsumerStatefulWidget {
  const FamilyBuilderScreen({super.key});
  @override
  ConsumerState<FamilyBuilderScreen> createState() =>
      _FamilyBuilderScreenState();
}

class _FamilyBuilderScreenState extends ConsumerState<FamilyBuilderScreen> {
  bool loading = true;
  String? error;
  Map<String, dynamic>? invitations;
  List<dynamic> familySpaces = const [];
  List<dynamic> matches = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final api = ref.read(apiProvider);
      final results = await Future.wait([
        api.getInvitations(),
        api.getFamilySpaces(),
      ]);
      final i = results[0] as Map<String, dynamic>;
      final spaces = results[1] as List<dynamic>;
      final person = await api.currentPersonId();
      final m =
          person == null ? <dynamic>[] : await api.getMatchCandidates(person);
      if (mounted) {
        setState(() {
          invitations = i;
          familySpaces = spaces;
          matches = m;
          loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          loading = false;
          error = 'Could not load family builder data.';
        });
      }
    }
  }

  Future<void> _createFamilySpace() async {
    final name = TextEditingController();
    final shouldCreate = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Create a family space'),
        content: TextField(
          controller: name,
          autofocus: true,
          textCapitalization: TextCapitalization.words,
          decoration: const InputDecoration(labelText: 'Family space name'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              if (name.text.trim().isNotEmpty) {
                Navigator.pop(dialogContext, true);
              }
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
    if (shouldCreate != true || !mounted) {
      name.dispose();
      return;
    }
    try {
      await ref.read(apiProvider).createFamilySpace(name: name.text.trim());
      if (mounted) await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not create this family space.')),
        );
      }
    } finally {
      name.dispose();
    }
  }

  Future<void> _addRelative() async {
    final name = TextEditingController();
    String relation = 'CHILD';
    String parentType = 'BIOLOGICAL';
    final ok = await showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        backgroundColor: _cream,
        builder: (_) => StatefulBuilder(
              builder: (context, setModal) => Padding(
                  padding: EdgeInsets.only(
                      left: 20,
                      right: 20,
                      top: 20,
                      bottom: MediaQuery.of(context).viewInsets.bottom + 24),
                  child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Add a family member',
                            style: TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.w800,
                                color: _forest)),
                        const SizedBox(height: 8),
                        const Text(
                            'Create the person and connect them immediately to your profile.',
                            style: TextStyle(color: _muted)),
                        const SizedBox(height: 18),
                        TextField(
                            controller: name,
                            autofocus: true,
                            decoration:
                                const InputDecoration(labelText: 'Full name')),
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                            initialValue: relation,
                            decoration: const InputDecoration(
                                labelText: 'Relationship to me'),
                            items: const [
                              DropdownMenuItem(
                                  value: 'PARENT', child: Text('Parent')),
                              DropdownMenuItem(
                                  value: 'CHILD', child: Text('Child')),
                              DropdownMenuItem(
                                  value: 'SIBLING', child: Text('Sibling')),
                              DropdownMenuItem(
                                  value: 'SPOUSE',
                                  child: Text('Spouse / partner')),
                            ],
                            onChanged: (v) =>
                                setModal(() => relation = v ?? 'CHILD')),
                        if (relation == 'PARENT' || relation == 'CHILD') ...[
                          const SizedBox(height: 12),
                          DropdownButtonFormField<String>(
                              initialValue: parentType,
                              decoration: const InputDecoration(
                                  labelText: 'Parent relationship'),
                              items: const [
                                DropdownMenuItem(
                                    value: 'BIOLOGICAL',
                                    child: Text('Biological')),
                                DropdownMenuItem(
                                    value: 'ADOPTIVE', child: Text('Adoptive')),
                                DropdownMenuItem(
                                    value: 'LEGAL', child: Text('Legal')),
                                DropdownMenuItem(
                                    value: 'STEP', child: Text('Step')),
                                DropdownMenuItem(
                                    value: 'GUARDIAN', child: Text('Guardian')),
                              ],
                              onChanged: (v) => setModal(
                                  () => parentType = v ?? 'BIOLOGICAL')),
                        ],
                        const SizedBox(height: 18),
                        SizedBox(
                            width: double.infinity,
                            child: FilledButton(
                                onPressed: () async {
                                  if (name.text.trim().isEmpty) return;
                                  try {
                                    final api = ref.read(apiProvider);
                                    final self = await api.currentPersonId();
                                    if (self == null) throw Exception();
                                    await api.addRelative(
                                        selfPersonId: self,
                                        name: name.text.trim(),
                                        relationshipType: relation,
                                        parentType: parentType);
                                    if (context.mounted) {
                                      Navigator.pop(context, true);
                                    }
                                  } catch (_) {
                                    if (context.mounted) {
                                      ScaffoldMessenger.of(context)
                                          .showSnackBar(const SnackBar(
                                              content: Text(
                                                  'Could not add this family member.')));
                                    }
                                  }
                                },
                                child: const Text('Add to family'))),
                      ])),
            ));
    if (ok == true) _load();
  }

  Future<void> _invite() async {
    final destination = TextEditingController();
    final hint = TextEditingController();
    String relation = 'SIBLING';
    String? familySpaceId;
    final result = await showModalBottomSheet<Map<String, dynamic>>(
        context: context,
        isScrollControlled: true,
        backgroundColor: _cream,
        builder: (_) => StatefulBuilder(
            builder: (context, setModal) => Padding(
                  padding: EdgeInsets.only(
                      left: 20,
                      right: 20,
                      top: 20,
                      bottom: MediaQuery.of(context).viewInsets.bottom + 24),
                  child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Invite a relative',
                            style: TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.w800,
                                color: _forest)),
                        const SizedBox(height: 8),
                        const Text(
                            'They can join independently and the confirmed branch will connect to yours.',
                            style: TextStyle(color: _muted)),
                        const SizedBox(height: 16),
                        TextField(
                            controller: destination,
                            decoration: const InputDecoration(
                                labelText: 'Email or phone (optional)')),
                        if (familySpaces.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          DropdownButtonFormField<String>(
                            initialValue: familySpaceId,
                            decoration: const InputDecoration(
                                labelText: 'Connect to a family space'),
                            items: [
                              const DropdownMenuItem<String>(
                                  child: Text('Just my person profile')),
                              ...familySpaces.map((entry) {
                                final space = (entry as Map?) ??
                                    const <String, dynamic>{};
                                return DropdownMenuItem<String>(
                                  value: '${space['id']}',
                                  child: Text(
                                      '${space['name'] ?? 'Family space'}'),
                                );
                              }),
                            ],
                            onChanged: (value) =>
                                setModal(() => familySpaceId = value),
                          ),
                        ],
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                            initialValue: relation,
                            decoration: const InputDecoration(
                                labelText: 'Their relationship to me'),
                            items: const [
                              DropdownMenuItem(
                                  value: 'PARENT', child: Text('Parent')),
                              DropdownMenuItem(
                                  value: 'CHILD', child: Text('Child')),
                              DropdownMenuItem(
                                  value: 'SIBLING', child: Text('Sibling')),
                              DropdownMenuItem(
                                  value: 'SPOUSE',
                                  child: Text('Spouse / partner'))
                            ],
                            onChanged: (v) =>
                                setModal(() => relation = v ?? 'SIBLING')),
                        const SizedBox(height: 12),
                        TextField(
                            controller: hint,
                            decoration: const InputDecoration(
                                labelText:
                                    'Optional note, e.g. “my wife’s brother”')),
                        const SizedBox(height: 18),
                        SizedBox(
                            width: double.infinity,
                            child: FilledButton(
                                onPressed: () async {
                                  try {
                                    final api = ref.read(apiProvider);
                                    final self = await api.currentPersonId();
                                    if (self == null) throw Exception();
                                    final out = await api.createInvitation(
                                        inviterPersonId: self,
                                        familySpaceId: familySpaceId,
                                        destination:
                                            destination.text.trim().isEmpty
                                                ? null
                                                : destination.text.trim(),
                                        relationshipType: relation,
                                        relationHint: hint.text.trim().isEmpty
                                            ? null
                                            : hint.text.trim());
                                    if (context.mounted) {
                                      Navigator.pop(context, out);
                                    }
                                  } catch (_) {
                                    if (context.mounted) {
                                      ScaffoldMessenger.of(context)
                                          .showSnackBar(const SnackBar(
                                              content: Text(
                                                  'Could not create the invitation.')));
                                    }
                                  }
                                },
                                child: const Text('Create invite'))),
                      ]),
                )));
    if (result != null && mounted) {
      await showDialog(
          context: context,
          builder: (_) => AlertDialog(
                  title: const Text('Invite ready'),
                  content: SelectableText(
                      '${result['shareText'] ?? ''}\n\nToken:\n${result['token'] ?? ''}'),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('Done'))
                  ]));
      _load();
    }
  }

  Future<void> _acceptInvite() async {
    final token = TextEditingController();
    final ok = await showDialog<bool>(
        context: context,
        builder: (_) => AlertDialog(
                title: const Text('Accept family invite'),
                content: TextField(
                    controller: token,
                    decoration:
                        const InputDecoration(labelText: 'Invite token')),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(context, false),
                      child: const Text('Cancel')),
                  FilledButton(
                      onPressed: () => Navigator.pop(context, true),
                      child: const Text('Connect'))
                ]));
    if (ok == true && token.text.trim().isNotEmpty) {
      try {
        await ref.read(apiProvider).acceptInvitation(token.text.trim());
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Family branch connected.')));
        }
        _load();
      } catch (_) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Invite is invalid or expired.')));
        }
      }
    }
  }

  Future<void> _revokeInvitation(String id) async {
    try {
      await ref.read(apiProvider).revokeInvitation(id);
      if (mounted) await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not revoke this invitation.')),
        );
      }
    }
  }

  Future<void> _resolve(String id, String action) async {
    try {
      await ref.read(apiProvider).resolveMatch(id, action);
      _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text(
                'This match needs ownership review and cannot be merged automatically.')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        backgroundColor: _cream,
        appBar: AppBar(
            backgroundColor: _cream,
            title: const Text('Build your family',
                style: TextStyle(fontWeight: FontWeight.w800, color: _forest)),
            actions: [
              IconButton(
                  onPressed: _invite,
                  icon: const Icon(Icons.person_add_alt_1_outlined)),
              IconButton(onPressed: _acceptInvite, icon: const Icon(Icons.link))
            ]),
        body: loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 10, 20, 30),
                    children: [
                      Container(
                          padding: const EdgeInsets.all(22),
                          decoration: BoxDecoration(
                              color: _forest,
                              borderRadius: BorderRadius.circular(26)),
                          child: const Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Grow one connected family',
                                    style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 23,
                                        fontWeight: FontWeight.w800)),
                                SizedBox(height: 8),
                                Text(
                                    'Add relatives directly or invite them to build their own branch. Confirmed connections join the same living graph.',
                                    style: TextStyle(
                                        color: Colors.white70, height: 1.4))
                              ])),
                      const SizedBox(height: 16),
                      Row(children: [
                        Expanded(
                            child: _ActionCard(
                                icon: Icons.person_add_alt_1,
                                title: 'Add relative',
                                onTap: _addRelative)),
                        const SizedBox(width: 10),
                        Expanded(
                            child: _ActionCard(
                                icon: Icons.link,
                                title: 'Accept invite',
                                onTap: _acceptInvite))
                      ]),
                      const SizedBox(height: 10),
                      _ActionCard(
                          icon: Icons.groups_2_outlined,
                          title: 'Create family space',
                          onTap: _createFamilySpace),
                      if (familySpaces.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        const Text('Your family spaces',
                            style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w800,
                                color: _forest)),
                        ...familySpaces.map((space) {
                          final data = (space as Map?) ?? const {};
                          final membership =
                              (data['myMembership'] as Map?) ?? const {};
                          return ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: const CircleAvatar(
                              backgroundColor: Color(0xFFE6EFEA),
                              child: Icon(Icons.groups_2, color: _forest),
                            ),
                            title: Text('${data['name'] ?? 'Family space'}'),
                            subtitle: Text(
                                '${data['privacy'] ?? 'INVITE_ONLY'} • ${membership['role'] ?? 'MEMBER'}'),
                          );
                        }),
                      ],
                      const SizedBox(height: 20),
                      const Text('Branch connections',
                          style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              color: _forest)),
                      const SizedBox(height: 8),
                      const _InfoCard(
                          icon: Icons.hub_outlined,
                          title: 'Independent relatives',
                          text:
                              'Your wife, brother, parents or in-laws can register separately. Invitations connect their canonical person to the existing graph without creating a second family universe.'),
                      const SizedBox(height: 10),
                      const _InfoCard(
                          icon: Icons.spellcheck_outlined,
                          title: 'Different names are okay',
                          text:
                              'Name variants and future matching are handled as person identity data. We never assume two similar names are the same person without review.'),
                      if (error != null)
                        Padding(
                            padding: const EdgeInsets.only(top: 12),
                            child: Text(error!,
                                style: const TextStyle(color: Colors.red))),
                      const SizedBox(height: 20),
                      const Text('Pending duplicate reviews',
                          style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              color: _forest)),
                      const SizedBox(height: 8),
                      if (matches.isEmpty)
                        const _InfoCard(
                            icon: Icons.verified_outlined,
                            title: 'No pending reviews',
                            text:
                                'Potential duplicate profiles will appear here when a family member flags a possible match.'),
                      ...matches.map((m) {
                        final a = (m['personA'] as Map?) ?? {};
                        final b = (m['personB'] as Map?) ?? {};
                        final an = ((a['names'] as List?)?.isNotEmpty ?? false)
                            ? ((a['names'] as List).first as Map)['fullName']
                            : 'Unknown';
                        final bn = ((b['names'] as List?)?.isNotEmpty ?? false)
                            ? ((b['names'] as List).first as Map)['fullName']
                            : 'Unknown';
                        return Card(
                            child: Padding(
                                padding: const EdgeInsets.all(14),
                                child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text('$an  ↔  $bn',
                                          style: const TextStyle(
                                              fontWeight: FontWeight.w800)),
                                      const SizedBox(height: 4),
                                      Text(
                                          '${m['reason'] ?? 'Possible duplicate'}',
                                          style:
                                              const TextStyle(color: _muted)),
                                      const SizedBox(height: 10),
                                      Row(children: [
                                        TextButton(
                                            onPressed: () => _resolve(
                                                '${m['id']}', 'DISMISS'),
                                            child: const Text('Not same')),
                                        const Spacer(),
                                        FilledButton(
                                            onPressed: () => _resolve(
                                                '${m['id']}', 'MERGE_A'),
                                            child: const Text('Keep first'))
                                      ])
                                    ])));
                      }),
                      const SizedBox(height: 20),
                      const Text('Invitations',
                          style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              color: _forest)),
                      const SizedBox(height: 8),
                      ...((invitations?['sent'] as List?) ?? const [])
                          .take(8)
                          .map((i) => ListTile(
                              contentPadding:
                                  const EdgeInsets.symmetric(horizontal: 4),
                              leading: const CircleAvatar(
                                  backgroundColor: Color(0xFFE6EFEA),
                                  child: Icon(Icons.send, color: _forest)),
                              title: Text(
                                  '${i['relationHint'] ?? i['relationshipType'] ?? 'Relative'}'),
                              subtitle: Text(
                                  '${i['status']} • ${i['inviteeDestination'] ?? 'share token'}'),
                              trailing: i['status'] == 'PENDING'
                                  ? IconButton(
                                      tooltip: 'Revoke invitation',
                                      onPressed: () =>
                                          _revokeInvitation('${i['id']}'),
                                      icon: const Icon(Icons.cancel_outlined),
                                    )
                                  : null)),
                    ])));
  }
}

class _ActionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final VoidCallback onTap;
  const _ActionCard(
      {required this.icon, required this.title, required this.onTap});
  @override
  Widget build(BuildContext c) => Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
              padding: const EdgeInsets.all(18),
              child: Row(children: [
                Icon(icon, color: _forest),
                const SizedBox(width: 10),
                Expanded(
                    child: Text(title,
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, color: _forest)))
              ]))));
}

class _InfoCard extends StatelessWidget {
  final IconData icon;
  final String title, text;
  const _InfoCard(
      {required this.icon, required this.title, required this.text});
  @override
  Widget build(BuildContext c) => Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            CircleAvatar(
                backgroundColor: _forest.withValues(alpha: 0.08),
                child: Icon(icon, color: _forest)),
            const SizedBox(width: 12),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(title,
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, color: _forest)),
                  const SizedBox(height: 5),
                  Text(text, style: const TextStyle(color: _muted, height: 1.4))
                ]))
          ])));
}
