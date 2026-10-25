import 'package:flutter/material.dart';

import '../../core/api_client.dart';

class PrivacyScreen extends StatefulWidget {
  final ApiClient api;

  const PrivacyScreen({required this.api, super.key});

  @override
  State<PrivacyScreen> createState() => _PrivacyScreenState();
}

class _PrivacyScreenState extends State<PrivacyScreen> {
  Map<String, dynamic> settings = {};
  List<dynamic> sessions = [];
  Map<String, dynamic>? deletion;
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final summary = await widget.api.privacySummary();
      if (!mounted) return;
      setState(() {
        settings = Map<String, dynamic>.from(summary['settings'] ?? {});
        sessions = List<dynamic>.from(summary['sessions'] ?? []);
        deletion = summary['deletionRequest'] == null
            ? null
            : Map<String, dynamic>.from(summary['deletionRequest']);
        loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        loading = false;
        error = 'Privacy settings could not be loaded.';
      });
    }
  }

  Future<void> _save(String key, dynamic value) async {
    try {
      final updated = await widget.api.updatePrivacySettings({key: value});
      if (mounted) setState(() => settings = updated);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not update privacy settings.')),
      );
    }
  }

  Future<void> _exportData() async {
    try {
      final result = await widget.api.requestDataExport();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text('Export request ${result['status'] ?? 'created'}.')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not request a data export.')),
      );
    }
  }

  Future<void> _requestDeletion() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete account?'),
        content: const Text(
          'Your account will be scheduled for deletion after a 7-day recovery '
          'period. You can cancel during that period.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Request deletion'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      final request = await widget.api.requestDeletion();
      if (!mounted) return;
      setState(() => deletion = request);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Deletion scheduled.')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not request account deletion.')),
      );
    }
  }

  Future<void> _revokeSession(String id) async {
    try {
      await widget.api.revokePrivacySession(id);
      if (!mounted) return;
      Navigator.pop(context);
      await load();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not revoke this session.')),
      );
    }
  }

  Future<void> _showSessions() {
    return showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Active sessions'),
        content: SizedBox(
          width: 360,
          child: ListView(
            shrinkWrap: true,
            children: sessions.map((session) {
              final active = (session['status'] ?? '') == 'ACTIVE';
              return ListTile(
                title: Text('${session['status'] ?? 'UNKNOWN'}'),
                subtitle: Text('Created ${session['createdAt'] ?? ''}'),
                trailing: active
                    ? TextButton(
                        onPressed: () => _revokeSession('${session['id']}'),
                        child: const Text('Revoke'),
                      )
                    : null,
              );
            }).toList(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Privacy & Security')),
      body: RefreshIndicator(
        onRefresh: load,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (error != null)
              ListTile(
                title: Text(error!),
                trailing: TextButton(
                  onPressed: load,
                  child: const Text('Retry'),
                ),
              ),
            const Text(
              'Your privacy, your family',
              style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            const Text(
              'Control how your profile and relationships can be discovered. '
              'Family connections are never changed automatically.',
              style: TextStyle(color: Colors.black54),
            ),
            const SizedBox(height: 20),
            Card(
              child: Column(
                children: [
                  SwitchListTile(
                    title: const Text('Discoverable'),
                    subtitle: const Text(
                      'Allow permitted family discovery to suggest your profile',
                    ),
                    value: settings['discoverable'] == true,
                    onChanged: (value) => _save('discoverable', value),
                  ),
                  const Divider(height: 1),
                  _visibilitySetting(
                    'Profile visibility',
                    'profileVisibility',
                    'FAMILY_ONLY',
                  ),
                  const Divider(height: 1),
                  _visibilitySetting(
                    'Relationship visibility',
                    'relationshipVisibility',
                    'FAMILY_ONLY',
                  ),
                  const Divider(height: 1),
                  _visibilitySetting(
                    'Location visibility',
                    'locationVisibility',
                    'PRIVATE',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.download_outlined),
                    title: const Text('Export my data'),
                    subtitle: const Text(
                      'Request a portable copy of your account and family data',
                    ),
                    onTap: _exportData,
                  ),
                  ListTile(
                    leading: const Icon(Icons.devices_outlined),
                    title: const Text('Active sessions'),
                    subtitle: Text(
                      '${sessions.where((session) => (session['status'] ?? '') == 'ACTIVE').length} active session(s)',
                    ),
                    onTap: _showSessions,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: ListTile(
                leading: const Icon(Icons.delete_outline, color: Colors.red),
                title: const Text(
                  'Delete account',
                  style: TextStyle(color: Colors.red),
                ),
                subtitle: Text(
                  deletion == null
                      ? 'Schedule account deletion with a 7-day recovery period.'
                      : 'Deletion is scheduled for '
                          '${deletion!['scheduledFor'] ?? 'later'}.',
                ),
                onTap: deletion == null ? _requestDeletion : null,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _visibilitySetting(String title, String key, String defaultValue) {
    const values = ['PRIVATE', 'FAMILY_ONLY', 'FAMILY'];
    final current = settings[key];
    final selected = values.contains(current) ? current : defaultValue;

    return ListTile(
      title: Text(title),
      subtitle: Text('$selected'.replaceAll('_', ' ')),
      trailing: DropdownButton<String>(
        value: selected,
        items: values
            .map(
              (value) => DropdownMenuItem(
                value: value,
                child: Text(value.replaceAll('_', ' ')),
              ),
            )
            .toList(),
        onChanged: (value) {
          if (value != null) _save(key, value);
        },
      ),
    );
  }
}
