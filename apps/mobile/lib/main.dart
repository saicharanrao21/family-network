import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'core/api_client.dart';
import 'core/app_state.dart';
import 'features/tree/family_explorer.dart';
import 'features/family/family_builder.dart';
import 'features/archive/archive_screen.dart';
import 'features/notifications/notifications_screen.dart';
import 'features/privacy/privacy_screen.dart';

const forest = Color(0xFF234F3D),
    cream = Color(0xFFF8F4EC),
    gold = Color(0xFFC5A45D),
    ink = Color(0xFF17221D),
    muted = Color(0xFF718078);

void main() => runApp(const ProviderScope(child: FamilyNetworkApp()));

class FamilyNetworkApp extends ConsumerStatefulWidget {
  const FamilyNetworkApp({super.key});
  @override
  ConsumerState<FamilyNetworkApp> createState() => _AppState();
}

class _AppState extends ConsumerState<FamilyNetworkApp> {
  late final GoRouter router;
  @override
  void initState() {
    super.initState();
    router = GoRouter(
        routes: [
          GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
          GoRoute(
              path: '/register', builder: (_, __) => const RegisterScreen()),
          ShellRoute(
              builder: (_, __, child) => AppShell(child: child),
              routes: [
                GoRoute(path: '/', builder: (_, __) => const HomeScreen()),
                GoRoute(
                    path: '/tree',
                    builder: (_, __) =>
                        FamilyExplorerScreen(api: ref.read(apiProvider))),
                GoRoute(
                    path: '/search', builder: (_, __) => const SearchScreen()),
                GoRoute(
                    path: '/family', builder: (_, __) => const FamilyScreen()),
                GoRoute(
                    path: '/archive',
                    builder: (_, __) => const ArchiveScreen()),
                GoRoute(
                    path: '/subscription',
                    builder: (_, __) =>
                        SubscriptionScreen(api: ref.read(apiProvider))),
                GoRoute(
                    path: '/notifications',
                    builder: (_, __) =>
                        NotificationsScreen(api: ref.read(apiProvider))),
                GoRoute(
                    path: '/builder',
                    builder: (_, __) => const FamilyBuilderScreen()),
                GoRoute(
                    path: '/privacy',
                    builder: (_, __) =>
                        PrivacyScreen(api: ref.read(apiProvider)))
              ])
        ],
        redirect: (c, s) {
          final logged = ref.read(authProvider);
          if (!logged &&
              s.uri.path != '/' &&
              s.uri.path != '/login' &&
              s.uri.path != '/register') {
            return '/login';
          }
          return null;
        });
    ref.read(authProvider.notifier).bootstrap();
  }

  @override
  Widget build(BuildContext context) => MaterialApp.router(
      title: 'Family Network',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
          useMaterial3: true,
          scaffoldBackgroundColor: cream,
          colorScheme: ColorScheme.fromSeed(seedColor: forest),
          fontFamily: 'Inter',
          cardTheme: const CardThemeData(
              margin: EdgeInsets.zero, elevation: 0, color: Colors.white),
          inputDecorationTheme: const InputDecorationTheme(
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.all(Radius.circular(16)),
                  borderSide: BorderSide.none),
              contentPadding:
                  EdgeInsets.symmetric(horizontal: 16, vertical: 15))),
      routerConfig: router);
}

class AppShell extends StatelessWidget {
  final Widget child;
  const AppShell({required this.child, super.key});
  @override
  Widget build(BuildContext c) => Scaffold(
      body: SafeArea(child: child),
      bottomNavigationBar: NavigationBar(
          backgroundColor: Colors.white,
          selectedIndex: _index(c),
          onDestinationSelected: (i) =>
              c.go(['/', '/tree', '/search', '/family'][i]),
          destinations: const [
            NavigationDestination(
                icon: Icon(Icons.home_outlined),
                selectedIcon: Icon(Icons.home),
                label: 'Home'),
            NavigationDestination(
                icon: Icon(Icons.account_tree_outlined),
                selectedIcon: Icon(Icons.account_tree),
                label: 'Tree'),
            NavigationDestination(icon: Icon(Icons.search), label: 'Search'),
            NavigationDestination(
                icon: Icon(Icons.groups_outlined),
                selectedIcon: Icon(Icons.groups),
                label: 'Family')
          ]));
  int _index(BuildContext c) {
    final p = GoRouterState.of(c).uri.path;
    return {'/': 0, '/tree': 1, '/search': 2, '/family': 3}[p] ?? 0;
  }
}

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginState();
}

class _LoginState extends ConsumerState<LoginScreen> {
  final e = TextEditingController(), p = TextEditingController();
  bool loading = false;
  @override
  Widget build(BuildContext c) => AuthScaffold(
          title: 'Welcome back',
          subtitle: 'Continue exploring your family.',
          children: [
            TextField(
                controller: e,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Email')),
            const SizedBox(height: 12),
            TextField(
                controller: p,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Password')),
            const SizedBox(height: 18),
            FilledButton(
                onPressed: loading
                    ? null
                    : () async {
                        setState(() => loading = true);
                        final ok = await ref
                            .read(authProvider.notifier)
                            .login(e.text, p.text);
                        if (mounted) {
                          setState(() => loading = false);
                        }
                        if (c.mounted && ok == null) c.go('/');
                      },
                child: Text(loading ? 'Signing in…' : 'Sign in')),
            TextButton(
                onPressed: () => c.go('/register'),
                child: const Text('Create an account'))
          ]);
}

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});
  @override
  ConsumerState<RegisterScreen> createState() => _RegisterState();
}

class _RegisterState extends ConsumerState<RegisterScreen> {
  final n = TextEditingController(),
      e = TextEditingController(),
      p = TextEditingController();
  @override
  Widget build(BuildContext c) => AuthScaffold(
          title: 'Create your family identity',
          subtitle: 'Start with yourself. Your family can grow from there.',
          children: [
            TextField(
                controller: n,
                decoration: const InputDecoration(labelText: 'Full name')),
            const SizedBox(height: 12),
            TextField(
                controller: e,
                decoration: const InputDecoration(labelText: 'Email')),
            const SizedBox(height: 12),
            TextField(
                controller: p,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Password')),
            const SizedBox(height: 18),
            FilledButton(
                onPressed: () async {
                  final ok = await ref
                      .read(authProvider.notifier)
                      .register(n.text, e.text, p.text);
                  if (c.mounted && ok == null) c.go('/');
                },
                child: const Text('Create my family profile')),
            TextButton(
                onPressed: () => c.go('/login'),
                child: const Text('Already have an account? Sign in'))
          ]);
}

class AuthScaffold extends StatelessWidget {
  final String title, subtitle;
  final List<Widget> children;
  const AuthScaffold(
      {required this.title,
      required this.subtitle,
      required this.children,
      super.key});
  @override
  Widget build(BuildContext c) => Scaffold(
      body: Center(
          child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: ListView(
                  padding: const EdgeInsets.all(24),
                  shrinkWrap: true,
                  children: [
                    const Icon(Icons.account_tree_rounded,
                        size: 56, color: forest),
                    const SizedBox(height: 18),
                    Text(title,
                        style: Theme.of(c).textTheme.headlineMedium?.copyWith(
                            fontWeight: FontWeight.w800, color: ink)),
                    const SizedBox(height: 6),
                    Text(subtitle, style: const TextStyle(color: muted)),
                    const SizedBox(height: 28),
                    ...children
                  ]))));
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});
  @override
  Widget build(BuildContext c) =>
      ListView(padding: const EdgeInsets.fromLTRB(20, 18, 20, 30), children: [
        Row(children: [
          const Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text('Good evening', style: TextStyle(color: muted)),
                Text('Your Family Universe',
                    style: TextStyle(
                        fontSize: 28, fontWeight: FontWeight.w800, color: ink))
              ])),
          CircleAvatar(
              backgroundColor: forest.withValues(alpha: 0.1),
              child: const Icon(Icons.person, color: forest))
        ]),
        const SizedBox(height: 22),
        Container(
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
                color: forest, borderRadius: BorderRadius.circular(28)),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Your family is a living network',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 21,
                      fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              const Text(
                  'Explore parents, branches, marriages and relatives from one place.',
                  style: TextStyle(color: Colors.white70)),
              const SizedBox(height: 18),
              FilledButton(
                  style: FilledButton.styleFrom(
                      backgroundColor: gold, foregroundColor: ink),
                  onPressed: () => c.go('/tree'),
                  child: const Text('Explore Family'))
            ])),
        const SizedBox(height: 18),
        const Row(children: [
          Expanded(child: Metric(title: 'People', value: '—')),
          SizedBox(width: 10),
          Expanded(child: Metric(title: 'Branches', value: '—')),
          SizedBox(width: 10),
          Expanded(child: Metric(title: 'Generations', value: '—'))
        ]),
        const SizedBox(height: 18),
        const Section(
            title: 'Family Today',
            child: ListTile(
                leading: CircleAvatar(
                    backgroundColor: Color(0xFFE6EFEA),
                    child: Icon(Icons.hub, color: forest)),
                title: Text('Build from the center'),
                subtitle: Text(
                    'Add parents, siblings, spouse and children. Every confirmed connection expands the network.'),
                trailing: Icon(Icons.chevron_right))),
        const Section(
            title: 'Privacy first',
            child: ListTile(
                leading: Icon(Icons.lock_outline, color: forest),
                title: Text('Your family graph is not public by default'),
                subtitle: Text(
                    'Connections require confirmation and visibility is controlled by the family member.')))
      ]);
}

class Metric extends StatelessWidget {
  final String title, value;
  const Metric({required this.title, required this.value, super.key});
  @override
  Widget build(BuildContext c) => Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: Colors.white, borderRadius: BorderRadius.circular(20)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(value,
            style: const TextStyle(
                fontSize: 22, fontWeight: FontWeight.w800, color: ink)),
        Text(title, style: const TextStyle(color: muted))
      ]));
}

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});
  @override
  ConsumerState<SearchScreen> createState() => _SearchState();
}

class _SearchState extends ConsumerState<SearchScreen> {
  final controller = TextEditingController();
  List<dynamic> results = [];
  bool loading = false;
  String error = '';
  final suggestions = [
    'My mother’s family',
    'People with surname variants',
    'Find my father’s siblings',
    'How am I related to someone?'
  ];
  Future<void> search(String q) async {
    if (q.trim().isEmpty) {
      setState(() => results = []);
      return;
    }
    setState(() => loading = true);
    try {
      final r = await ref.read(apiProvider).searchPeople(q);
      if (mounted) {
        setState(() => results = r
          ..sort((a, b) => (b['score'] ?? 0).compareTo(a['score'] ?? 0)));
      }
    } catch (e) {
      if (mounted) setState(() => error = 'Search could not be completed.');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext c) =>
      ListView(padding: const EdgeInsets.fromLTRB(20, 20, 20, 30), children: [
        Text('Find your family',
            style: Theme.of(c)
                .textTheme
                .headlineMedium
                ?.copyWith(fontWeight: FontWeight.w800, color: ink)),
        const SizedBox(height: 8),
        const Text(
            'Search every connected generation, including alternate and historical names.',
            style: TextStyle(color: muted)),
        const SizedBox(height: 16),
        TextField(
            controller: controller,
            onChanged: (v) {
              setState(() => error = '');
              search(v);
            },
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
                hintText: 'Search a person, surname or spelling…',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: controller.text.isEmpty
                    ? null
                    : IconButton(
                        onPressed: () {
                          controller.clear();
                          setState(() => results = []);
                        },
                        icon: const Icon(Icons.close)))),
        const SizedBox(height: 18),
        if (loading) const LinearProgressIndicator(),
        if (error.isNotEmpty)
          Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(error, style: const TextStyle(color: Colors.red))),
        if (results.isEmpty && !loading && controller.text.trim().isEmpty) ...[
          const Text('Explore',
              style: TextStyle(
                  fontSize: 20, fontWeight: FontWeight.w800, color: ink)),
          const SizedBox(height: 8),
          ...suggestions.map((s) => Card(
              child: ListTile(
                  leading: const CircleAvatar(
                      backgroundColor: Color(0xFFE6EFEA),
                      child: Icon(Icons.hub, color: forest)),
                  title: Text(s),
                  subtitle: const Text('Start a family search'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => controller.text = s))),
          const SizedBox(height: 18),
          const Section(
              title: 'Name intelligence',
              child: ListTile(
                  leading: Icon(Icons.manage_search, color: forest),
                  title: Text('We keep name variants connected'),
                  subtitle: Text(
                      'Maiden names, married names, alternate spellings and transliterations can point to the same person without automatically merging identities.')))
        ],
        if (results.isNotEmpty) ...[
          Row(children: [
            const Expanded(
                child: Text('People found',
                    style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: ink))),
            Text('${results.length}', style: const TextStyle(color: muted))
          ]),
          const SizedBox(height: 8),
          ...results.map((r) => Card(
              child: ListTile(
                  leading: CircleAvatar(
                      backgroundColor: forest.withValues(alpha: 0.1),
                      child: const Icon(Icons.person, color: forest)),
                  title: Text(r['name'] ?? 'Unknown'),
                  subtitle: Text(
                      '${r['reason'] ?? 'name match'}${(r['names'] is List && r['names'].length > 1) ? ' • ${r['names'].length} name variants' : ''}'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    ScaffoldMessenger.of(c).showSnackBar(SnackBar(
                        content: Text('Selected ${r['name'] ?? 'person'}')));
                  })))
        ],
      ]);
}

class SubscriptionScreen extends StatefulWidget {
  final ApiClient api;
  const SubscriptionScreen({required this.api, super.key});
  @override
  State<SubscriptionScreen> createState() => _SubscriptionState();
}

class _SubscriptionState extends State<SubscriptionScreen> {
  Map<String, dynamic>? current;
  List<dynamic> plans = [];
  bool loading = true;
  String message = '';
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final c = await widget.api.mySubscription();
      final p = await widget.api.subscriptionPlans();
      if (mounted) {
        setState(() {
          current = c;
          plans = p;
          loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          loading = false;
          message = 'Subscription information could not be loaded.';
        });
      }
    }
  }

  Future<void> _choose(Map<String, dynamic> plan) async {
    if (plan['code'] == 'FREE') return;
    final r = await widget.api
        .startCheckout(planCode: plan['code'], provider: 'razorpay');
    if (mounted) {
      showDialog(
          context: context,
          builder: (_) => AlertDialog(
                  title: Text(plan['name'] ?? 'Plan'),
                  content: Text(r['message'] ?? 'Checkout is ready.'),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('OK'))
                  ]));
    }
  }

  @override
  Widget build(BuildContext c) => Scaffold(
      appBar: AppBar(title: const Text('Plans & Membership')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(padding: const EdgeInsets.all(20), children: [
              const Text('Choose how you want to preserve your family',
                  style: TextStyle(
                      fontSize: 26, fontWeight: FontWeight.w800, color: ink)),
              const SizedBox(height: 8),
              const Text(
                  'The free plan remains useful. Premium plans add capacity, tools and remove ads.',
                  style: TextStyle(color: muted)),
              if (message.isNotEmpty)
                Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(message,
                        style: const TextStyle(color: Colors.red))),
              const SizedBox(height: 18),
              ...plans.map((p) => Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(24)),
                  child: Padding(
                      padding: const EdgeInsets.all(18),
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(children: [
                              Expanded(
                                  child: Text(p['name'] ?? p['code'],
                                      style: const TextStyle(
                                          fontSize: 20,
                                          fontWeight: FontWeight.w800,
                                          color: ink))),
                              Text(
                                  p['priceInr'] == 0
                                      ? 'Free'
                                      : '₹${p['priceInr']}/${p['billing'] == 'YEARLY' ? 'yr' : 'mo'}',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      color: forest))
                            ]),
                            const SizedBox(height: 10),
                            ...List<String>.from(p['features'] ?? const [])
                                .take(6)
                                .map((f) => Padding(
                                    padding:
                                        const EdgeInsets.symmetric(vertical: 3),
                                    child: Row(children: [
                                      const Icon(Icons.check_circle_outline,
                                          size: 18, color: forest),
                                      const SizedBox(width: 8),
                                      Expanded(
                                          child: Text(f
                                              .replaceAll('_', ' ')
                                              .toLowerCase()))
                                    ]))),
                            const SizedBox(height: 12),
                            if (p['code'] != 'FREE')
                              SizedBox(
                                  width: double.infinity,
                                  child: FilledButton(
                                      onPressed: () =>
                                          _choose(Map<String, dynamic>.from(p)),
                                      child: const Text('Continue to payment')))
                          ]))))
            ]));
}

class FamilyScreen extends StatelessWidget {
  const FamilyScreen({super.key});
  @override
  Widget build(BuildContext c) =>
      ListView(padding: const EdgeInsets.all(20), children: [
        Text('Your Family',
            style: Theme.of(c)
                .textTheme
                .headlineMedium
                ?.copyWith(fontWeight: FontWeight.w800, color: ink)),
        const SizedBox(height: 8),
        const Text(
            'One private space for the people, memories and branches you choose to connect.',
            style: TextStyle(color: muted)),
        const SizedBox(height: 18),
        Section(
            title: 'Family Space',
            child: ListTile(
                leading: const CircleAvatar(
                    backgroundColor: Color(0xFFE6EFEA),
                    child: Icon(Icons.groups, color: forest)),
                title: const Text('My Family'),
                subtitle:
                    const Text('Invite relatives and grow the shared graph'),
                trailing: IconButton(
                    onPressed: () => c.go('/builder'),
                    icon: const Icon(Icons.chevron_right)))),
        Section(
            title: 'Preserve',
            child: Column(children: [
              ListTile(
                  leading:
                      const Icon(Icons.photo_library_outlined, color: forest),
                  title: const Text('Memories & Stories'),
                  subtitle: const Text(
                      'Photos, family stories and important moments'),
                  onTap: () => c.go('/archive')),
              ListTile(
                  leading: const Icon(Icons.event_outlined, color: forest),
                  title: const Text('Events'),
                  subtitle: const Text('Birthdays, anniversaries and reunions'),
                  onTap: () => c.go('/archive')),
              ListTile(
                  leading:
                      const Icon(Icons.description_outlined, color: forest),
                  title: const Text('Family archive'),
                  subtitle: const Text('Documents and historical records'),
                  onTap: () => c.go('/archive'))
            ])),
        Section(
            title: 'Premium',
            child: ListTile(
                leading: const Icon(Icons.auto_awesome, color: gold),
                title: const Text('Family Plus / Pro'),
                subtitle: const Text(
                    'More storage, advanced exploration, AI history tools and no ads'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => c.go('/subscription'))),
        Section(
            title: 'Privacy & Security',
            child: ListTile(
                leading: const Icon(Icons.lock_outline, color: forest),
                title: const Text('Privacy & Security'),
                subtitle: const Text(
                    'Visibility, data export, sessions and account controls'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => c.go('/privacy')))
      ]);
}

class Section extends StatelessWidget {
  final String title;
  final Widget child;
  const Section({required this.title, required this.child, super.key});
  @override
  Widget build(BuildContext c) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title,
            style: Theme.of(c)
                .textTheme
                .titleLarge
                ?.copyWith(fontWeight: FontWeight.w800, color: ink)),
        const SizedBox(height: 8),
        Card(
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
            child: Padding(padding: const EdgeInsets.all(8), child: child))
      ]));
}
