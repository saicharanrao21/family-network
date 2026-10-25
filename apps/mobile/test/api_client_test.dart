import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:family_network/core/api_client.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('default API base URL includes the backend route prefix', () {
    final api = ApiClient();

    expect(api.dio.options.baseUrl, 'http://localhost:3000/api/v1');
  });

  test('configured API base URL is preserved', () {
    final api = ApiClient(baseUrl: 'https://api.example.test/api/v1');

    expect(api.dio.options.baseUrl, 'https://api.example.test/api/v1');
  });

  test('logout clears the cached person identity', () async {
    SharedPreferences.setMockInitialValues({});
    final api = ApiClient();
    await api.saveTokens({
      'accessToken': 'access',
      'refreshToken': 'refresh',
      'userId': 'user-1',
      'personId': 'person-1',
    });

    expect(await api.currentPersonId(), 'person-1');
    await api.logout();
    expect(await api.currentPersonId(), isNull);
  });

  test('concurrent unauthorized requests share a refresh and retry once',
      () async {
    SharedPreferences.setMockInitialValues({
      'accessToken': 'expired-access',
      'refreshToken': 'valid-refresh',
      'userId': 'user-1',
    });
    final api = ApiClient(baseUrl: 'https://api.example.test/api/v1');
    final adapter = _RefreshingAdapter();
    api.dio.httpClientAdapter = adapter;

    final responses = await Future.wait([
      api.dio.get<Map<String, dynamic>>('/protected/one'),
      api.dio.get<Map<String, dynamic>>('/protected/two'),
    ]);

    expect(responses.map((response) => response.data?['ok']), [true, true]);
    expect(adapter.refreshRequests, 1);
    expect(adapter.protectedRequests, 4);
    expect(await api.token(), 'refreshed-access');
  });
}

class _RefreshingAdapter implements HttpClientAdapter {
  int refreshRequests = 0;
  int protectedRequests = 0;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    if (options.path == '/auth/refresh') {
      refreshRequests++;
      expect((options.data as Map<String, dynamic>)['refreshToken'],
          'valid-refresh');
      return _jsonResponse(200, {
        'accessToken': 'refreshed-access',
        'refreshToken': 'rotated-refresh',
        'userId': 'user-1',
      });
    }

    protectedRequests++;
    if (options.headers['Authorization'] == 'Bearer refreshed-access') {
      return _jsonResponse(200, {'ok': true});
    }
    return _jsonResponse(401, {'message': 'Unauthorized'});
  }

  @override
  void close({bool force = false}) {}

  ResponseBody _jsonResponse(int status, Map<String, dynamic> body) {
    return ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType]
      },
    );
  }
}
