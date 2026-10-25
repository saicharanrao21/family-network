import 'package:flutter_test/flutter_test.dart';
import 'package:family_network/core/api_client.dart';

void main() {
  test('default API base URL includes the backend route prefix', () {
    final api = ApiClient();

    expect(api.dio.options.baseUrl, 'http://localhost:3000/api/v1');
  });

  test('configured API base URL is preserved', () {
    final api = ApiClient(baseUrl: 'https://api.example.test/api/v1');

    expect(api.dio.options.baseUrl, 'https://api.example.test/api/v1');
  });
}
