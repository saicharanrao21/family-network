import 'package:flutter/material.dart';

import '../../core/api_client.dart';

const _forest = Color(0xFF234F3D);
const _ink = Color(0xFF17221D);
const _muted = Color(0xFF718078);

class NotificationsScreen extends StatefulWidget {
  final ApiClient api;

  const NotificationsScreen({required this.api, super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<dynamic> items = [];
  Map<String, dynamic> preferences = {};
  bool loading = true;
  String? error;

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
      final response = await Future.wait([
        widget.api.notifications(),
        widget.api.notificationPreferences(),
      ]);
      if (!mounted) return;
      setState(() {
        items = response[0] as List<dynamic>;
        preferences = response[1] as Map<String, dynamic>;
        loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        loading = false;
        error = 'Could not load notifications. Please try again.';
      });
    }
  }

  Future<void> _toggle(String key, bool value) async {
    final previousValue = preferences[key];
    setState(() => preferences[key] = value);
    try {
      await widget.api.updateNotificationPreferences({key: value});
    } catch (_) {
      if (!mounted) return;
      setState(() => preferences[key] = previousValue);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Could not update notification settings.')),
      );
    }
  }

  Future<void> _markRead(Map notification) async {
    try {
      await widget.api.markNotificationRead('${notification['id']}');
      await _load();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not update this notification.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  if (error != null)
                    Card(
                      child: ListTile(
                        title: Text(error!),
                        trailing: TextButton(
                          onPressed: _load,
                          child: const Text('Retry'),
                        ),
                      ),
                    ),
                  const Text(
                    'Delivery preferences',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: _ink,
                    ),
                  ),
                  const SizedBox(height: 8),
                  _setting(
                    'emailEnabled',
                    'Email notifications',
                    'Security, invitations and family updates',
                  ),
                  _setting(
                    'smsEnabled',
                    'SMS',
                    'OTP and important transactional alerts',
                  ),
                  _setting(
                    'whatsappEnabled',
                    'WhatsApp',
                    'OTP and important family alerts',
                  ),
                  _setting(
                    'pushEnabled',
                    'Push notifications',
                    'Updates on this device',
                  ),
                  const SizedBox(height: 22),
                  const Text(
                    'Recent notifications',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: _ink,
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (items.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 30),
                      child: Center(
                        child: Text(
                          'You are all caught up.',
                          style: TextStyle(color: _muted),
                        ),
                      ),
                    )
                  else
                    ...items.map(
                      (item) => Card(
                        child: ListTile(
                          leading: const CircleAvatar(
                            backgroundColor: Color(0x1A234F3D),
                            child: Icon(
                              Icons.notifications_none,
                              color: _forest,
                            ),
                          ),
                          title: Text('${item['title'] ?? ''}'),
                          subtitle: Text('${item['body'] ?? ''}'),
                          onTap: item['readAt'] == null
                              ? () => _markRead(item as Map)
                              : null,
                        ),
                      ),
                    ),
                ],
              ),
            ),
    );
  }

  Widget _setting(String key, String title, String subtitle) {
    return SwitchListTile(
      contentPadding: EdgeInsets.zero,
      value: (preferences[key] ?? true) == true,
      onChanged: (value) => _toggle(key, value),
      title: Text(
        title,
        style: const TextStyle(fontWeight: FontWeight.w700),
      ),
      subtitle: Text(subtitle, style: const TextStyle(color: _muted)),
    );
  }
}
