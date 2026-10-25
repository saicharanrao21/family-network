# Family Network Mobile — 1.0.0

Flutter client for the Family Network product.

## Supported release targets

- Android release APK/AAB via CI
- iOS release build via CI (signing is injected in the deployment environment)
- Flutter web/desktop can be enabled from the same source when required

The repository intentionally does not contain generated platform folders or signing material. CI creates the Android/iOS platform shells with `flutter create --platforms=android,ios .` before building. This keeps generated platform boilerplate reproducible and prevents credentials/certificates from entering source control.

## Local setup

```bash
flutter create --platforms=android,ios .
flutter pub get
flutter analyze
flutter test
flutter run
```

The API client defaults to `http://localhost:3000/api/v1`, matching the backend's global route prefix. Override it for another environment by including `/api/v1`, for example:

```bash
flutter run --dart-define=API_BASE_URL=https://api.example.com/api/v1
```
