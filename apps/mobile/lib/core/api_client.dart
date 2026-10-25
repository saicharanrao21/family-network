import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ApiClient {
  final Dio dio;
  Future<String?>? _refreshing;

  ApiClient({String? baseUrl})
      : dio = Dio(BaseOptions(
            baseUrl: baseUrl ??
                const String.fromEnvironment('API_BASE_URL',
                    defaultValue: 'http://localhost:3000/api/v1'),
            headers: {'Content-Type': 'application/json'})) {
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final accessToken = await token();
        if (accessToken != null && accessToken.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $accessToken';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        final request = error.requestOptions;
        if (error.response?.statusCode != 401 ||
            request.path == '/auth/refresh' ||
            request.extra['authRefreshRetried'] == true) {
          handler.next(error);
          return;
        }

        try {
          final accessToken = await _refreshAccessToken();
          if (accessToken == null) {
            handler.next(error);
            return;
          }
          request
            ..headers['Authorization'] = 'Bearer $accessToken'
            ..extra['authRefreshRetried'] = true;
          handler.resolve(await dio.fetch<dynamic>(request));
        } on DioException catch (refreshError) {
          if (refreshError.response?.statusCode == 401 ||
              refreshError.response?.statusCode == 403) {
            await logout();
          }
          handler.reject(refreshError);
        } catch (refreshError) {
          handler.reject(
            DioException(requestOptions: request, error: refreshError),
          );
        }
      },
    ));
  }

  Future<String?> _refreshAccessToken() {
    final refreshInProgress = _refreshing;
    if (refreshInProgress != null) return refreshInProgress;
    final refresh = _performRefresh();
    _refreshing = refresh;
    return refresh.whenComplete(() => _refreshing = null);
  }

  Future<String?> _performRefresh() async {
    final preferences = await SharedPreferences.getInstance();
    final refreshToken = preferences.getString('refreshToken');
    if (refreshToken == null || refreshToken.isEmpty) return null;
    final response = await dio.post<Map<String, dynamic>>(
      '/auth/refresh',
      data: {'refreshToken': refreshToken},
    );
    final tokens = Map<String, dynamic>.from(response.data!);
    await saveTokens(tokens);
    final accessToken = tokens['accessToken'] as String?;
    return accessToken?.isNotEmpty == true ? accessToken : null;
  }

  Future<void> saveTokens(Map<String, dynamic> data) async {
    final p = await SharedPreferences.getInstance();
    await p.setString('accessToken', data['accessToken'] ?? '');
    await p.setString('refreshToken', data['refreshToken'] ?? '');
    await p.setString('userId', data['userId'] ?? '');
    if (data['personId'] != null) {
      await p.setString('personId', data['personId']);
      _cachedPersonId = data['personId']?.toString();
    }
  }

  Future<Map<String, dynamic>> register(
      {required String name,
      String? email,
      String? phone,
      String? password}) async {
    final r = await dio.post('/auth/register', data: {
      'name': name,
      'email': email,
      'phone': phone,
      'password': password
    });
    final d = Map<String, dynamic>.from(r.data);
    await saveTokens(d);
    return d;
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    final r = await dio
        .post('/auth/login', data: {'email': email, 'password': password});
    final d = Map<String, dynamic>.from(r.data);
    await saveTokens(d);
    return d;
  }

  Future<void> logout() async {
    final p = await SharedPreferences.getInstance();
    await p.remove('accessToken');
    await p.remove('refreshToken');
    await p.remove('userId');
    await p.remove('personId');
    _cachedPersonId = null;
  }

  Future<String?> token() async {
    final p = await SharedPreferences.getInstance();
    return p.getString('accessToken');
  }

  String? _cachedPersonId;
  Future<String?> currentPersonId() async {
    if (_cachedPersonId != null) return _cachedPersonId;
    final p = await SharedPreferences.getInstance();
    _cachedPersonId = p.getString('personId');
    return _cachedPersonId;
  }

  Future<Map<String, dynamic>> getGraph(String focusPersonId,
      {int depth = 2}) async {
    final t = await token();
    final r = await dio.get('/graph',
        queryParameters: {'focus': focusPersonId, 'depth': depth},
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return Map<String, dynamic>.from(r.data);
  }

  Future<List<dynamic>> searchPeople(String query, {int limit = 30}) async {
    final t = await token();
    final r = await dio.get('/search/people',
        queryParameters: {'q': query, 'limit': limit},
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return List<dynamic>.from(
        (r.data as Map<String, dynamic>)['results'] ?? const []);
  }

  Future<List<dynamic>> surnameSuggestions(String personId,
      {int limit = 30}) async {
    final t = await token();
    final r = await dio.get('/search/surname-suggestions',
        queryParameters: {'personId': personId, 'limit': limit},
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return List<dynamic>.from(r.data as List);
  }

  Future<Map<String, dynamic>> getKinship(String from, String to) async {
    final t = await token();
    final r = await dio.get('/relationships/kinship',
        queryParameters: {'from': from, 'to': to},
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return Map<String, dynamic>.from(r.data);
  }

  Future<Map<String, dynamic>> addRelative(
      {required String selfPersonId,
      required String name,
      required String relationshipType,
      String? parentType}) async {
    final t = await token();
    final r = await dio.post('/family-builder/relative',
        data: {
          'selfPersonId': selfPersonId,
          'name': name,
          'relationshipType': relationshipType,
          'parentType': parentType
        },
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return Map<String, dynamic>.from(r.data);
  }

  Future<Map<String, dynamic>> createInvitation(
      {required String inviterPersonId,
      String? familySpaceId,
      String? destination,
      required String relationshipType,
      String? relationHint}) async {
    final t = await token();
    final r = await dio.post('/family-builder/invite',
        data: {
          'inviterPersonId': inviterPersonId,
          'familySpaceId': familySpaceId,
          'destination': destination,
          'relationshipType': relationshipType,
          'relationHint': relationHint
        },
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return Map<String, dynamic>.from(r.data);
  }

  Future<List<dynamic>> getFamilySpaces() async {
    final r = await dio.get('/family-builder/family-spaces',
        options: Options(headers: {'Authorization': '******'}));
    return List<dynamic>.from(r.data as List);
  }

  Future<Map<String, dynamic>> createFamilySpace(
      {required String name,
      String? description,
      String privacy = 'INVITE_ONLY'}) async {
    final r = await dio.post('/family-builder/family-spaces',
        data: {'name': name, 'description': description, 'privacy': privacy},
        options: Options(headers: {'Authorization': '******'}));
    return Map<String, dynamic>.from(r.data);
  }

  Future<Map<String, dynamic>> getInvitations() async {
    final t = await token();
    final r = await dio.get('/family-builder/invitations',
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return Map<String, dynamic>.from(r.data);
  }

  Future<Map<String, dynamic>> acceptInvitation(String inviteToken) async {
    final t = await token();
    final r = await dio.post('/family-builder/invitations/accept',
        data: {'token': inviteToken},
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return Map<String, dynamic>.from(r.data);
  }

  Future<Map<String, dynamic>> revokeInvitation(String invitationId) async {
    final r = await dio.post('/family-builder/invitations/$invitationId/revoke',
        options: Options(headers: {'Authorization': '******'}));
    return Map<String, dynamic>.from(r.data);
  }

  Future<List<dynamic>> getMatchCandidates(String personId) async {
    final t = await token();
    final r = await dio.get('/family-builder/matches',
        queryParameters: {'personId': personId},
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return List<dynamic>.from(r.data as List);
  }

  Future<Map<String, dynamic>> createMatchCandidate(
      {required String personAId,
      required String personBId,
      required String reason,
      double? confidence}) async {
    final t = await token();
    final r = await dio.post('/family-builder/matches',
        data: {
          'personAId': personAId,
          'personBId': personBId,
          'reason': reason,
          'confidence': confidence
        },
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return Map<String, dynamic>.from(r.data);
  }

  Future<Map<String, dynamic>> resolveMatch(String id, String action) async {
    final t = await token();
    final r = await dio.post('/family-builder/matches/$id/resolve',
        data: {'action': action},
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return Map<String, dynamic>.from(r.data);
  }

  Future<void> loadCachedIdentity() async {
    final p = await SharedPreferences.getInstance();
    _cachedPersonId = p.getString('personId');
  }

  Future<Map<String, dynamic>?> me() async {
    final t = await token();
    if (t == null || t.isEmpty) return null;
    final r = await dio.get('/auth/me',
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return Map<String, dynamic>.from(r.data);
  }
}

// Phase 7: family archive APIs.
extension ArchiveApi on ApiClient {
  Future<Map<String, dynamic>> archiveOverview() async {
    final t = await token();
    final r = await dio.get('/archive/overview',
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return Map<String, dynamic>.from(r.data);
  }

  Future<List<dynamic>> memories() async {
    final t = await token();
    final r = await dio.get('/archive/memories',
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return List<dynamic>.from(r.data as List);
  }

  Future<Map<String, dynamic>> createMemory(
      {required String title,
      String? description,
      String type = 'TEXT',
      String? capturedAt,
      List<String> personIds = const []}) async {
    final t = await token();
    final r = await dio.post('/archive/memories',
        data: {
          'title': title,
          'description': description,
          'type': type,
          'capturedAt': capturedAt,
          'personIds': personIds
        },
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return Map<String, dynamic>.from(r.data);
  }

  Future<List<dynamic>> stories() async {
    final t = await token();
    final r = await dio.get('/archive/stories',
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return List<dynamic>.from(r.data as List);
  }

  Future<Map<String, dynamic>> createStory(
      {required String title,
      required String body,
      List<String> personIds = const []}) async {
    final t = await token();
    final r = await dio.post('/archive/stories',
        data: {'title': title, 'body': body, 'personIds': personIds},
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return Map<String, dynamic>.from(r.data);
  }

  Future<List<dynamic>> events({String? from, String? to}) async {
    final t = await token();
    final r = await dio.get('/archive/events',
        queryParameters: {'from': from, 'to': to},
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return List<dynamic>.from(r.data as List);
  }

  Future<Map<String, dynamic>> createEvent(
      {required String title,
      required String startsAt,
      String type = 'OTHER',
      String? description,
      List<String> personIds = const []}) async {
    final t = await token();
    final r = await dio.post('/archive/events',
        data: {
          'title': title,
          'startsAt': startsAt,
          'type': type,
          'description': description,
          'personIds': personIds
        },
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return Map<String, dynamic>.from(r.data);
  }

  Future<List<dynamic>> documents() async {
    final t = await token();
    final r = await dio.get('/archive/documents',
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return List<dynamic>.from(r.data as List);
  }
}

// Phase 9: subscription and entitlement APIs.
extension SubscriptionApi on ApiClient {
  Future<List<dynamic>> subscriptionPlans() async {
    final r = await dio.get('/subscriptions/plans');
    return List<dynamic>.from(r.data as List);
  }

  Future<Map<String, dynamic>> mySubscription() async {
    final t = await token();
    final r = await dio.get('/subscriptions/me',
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return Map<String, dynamic>.from(r.data);
  }

  Future<Map<String, dynamic>> startCheckout(
      {required String planCode, required String provider}) async {
    final t = await token();
    final r = await dio.post('/subscriptions/checkout',
        data: {'planCode': planCode, 'provider': provider},
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return Map<String, dynamic>.from(r.data);
  }

  Future<Map<String, dynamic>> cancelSubscription() async {
    final t = await token();
    final r = await dio.post('/subscriptions/cancel',
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return Map<String, dynamic>.from(r.data);
  }
}

// Phase 10: notifications and delivery preferences.
extension NotificationApi on ApiClient {
  Future<List<dynamic>> notifications({bool unreadOnly = false}) async {
    final t = await token();
    final r = await dio.get(
        unreadOnly ? '/notifications/unread' : '/notifications',
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return List<dynamic>.from(r.data as List);
  }

  Future<Map<String, dynamic>> notificationPreferences() async {
    final t = await token();
    final r = await dio.get('/notifications/preferences',
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return Map<String, dynamic>.from(r.data);
  }

  Future<Map<String, dynamic>> updateNotificationPreferences(
      Map<String, bool> data) async {
    final t = await token();
    final r = await dio.patch('/notifications/preferences',
        data: data, options: Options(headers: {'Authorization': 'Bearer $t'}));
    return Map<String, dynamic>.from(r.data);
  }

  Future<void> markNotificationRead(String id) async {
    final t = await token();
    await dio.post('/notifications/$id/read',
        options: Options(headers: {'Authorization': 'Bearer $t'}));
  }

  Future<void> registerDeviceToken(
      {required String tokenValue, required String platform}) async {
    final t = await token();
    await dio.post('/notifications/devices',
        data: {'token': tokenValue, 'platform': platform},
        options: Options(headers: {'Authorization': 'Bearer $t'}));
  }
}

// Phase 11: privacy, security and data-rights APIs.
extension PrivacyApi on ApiClient {
  Future<Map<String, dynamic>> privacySummary() async {
    final t = await token();
    final r = await dio.get('/privacy/summary',
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return Map<String, dynamic>.from(r.data);
  }

  Future<Map<String, dynamic>> privacySettings() async {
    final t = await token();
    final r = await dio.get('/privacy/settings',
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return Map<String, dynamic>.from(r.data);
  }

  Future<Map<String, dynamic>> updatePrivacySettings(
      Map<String, dynamic> data) async {
    final t = await token();
    final r = await dio.patch('/privacy/settings',
        data: data, options: Options(headers: {'Authorization': 'Bearer $t'}));
    return Map<String, dynamic>.from(r.data);
  }

  Future<List<dynamic>> privacySessions() async {
    final t = await token();
    final r = await dio.get('/privacy/sessions',
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return List<dynamic>.from(r.data as List);
  }

  Future<void> revokePrivacySession(String id) async {
    final t = await token();
    await dio.post('/privacy/sessions/$id/revoke',
        options: Options(headers: {'Authorization': 'Bearer $t'}));
  }

  Future<Map<String, dynamic>> requestDataExport() async {
    final t = await token();
    final r = await dio.post('/privacy/export/request',
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return Map<String, dynamic>.from(r.data);
  }

  Future<Map<String, dynamic>> requestDeletion() async {
    final t = await token();
    final r = await dio.post('/privacy/deletion/request',
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return Map<String, dynamic>.from(r.data);
  }

  Future<Map<String, dynamic>> cancelDeletion() async {
    final t = await token();
    final r = await dio.post('/privacy/deletion/cancel',
        options: Options(headers: {'Authorization': 'Bearer $t'}));
    return Map<String, dynamic>.from(r.data);
  }
}
