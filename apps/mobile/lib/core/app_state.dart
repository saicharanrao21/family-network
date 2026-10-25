import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';

final apiProvider = Provider<ApiClient>((ref) => ApiClient());
final authProvider = StateNotifierProvider<AuthController, bool>(
    (ref) => AuthController(ref.read(apiProvider)));

class AuthController extends StateNotifier<bool> {
  final ApiClient api;
  AuthController(this.api) : super(false);
  Future<void> bootstrap() async {
    try {
      await api.loadCachedIdentity();
      state = await api.token().then((v) => v != null && v.isNotEmpty);
    } catch (_) {
      state = false;
    }
  }

  Future<String?> login(String email, String password) async {
    try {
      await api.login(email, password);
      state = true;
      return null;
    } catch (e) {
      return 'Unable to sign in. Please check your details.';
    }
  }

  Future<String?> register(String name, String email, String password) async {
    try {
      await api.register(name: name, email: email, password: password);
      state = true;
      return null;
    } catch (e) {
      return 'Unable to create your account.';
    }
  }

  Future<void> logout() async {
    await api.logout();
    state = false;
  }
}
