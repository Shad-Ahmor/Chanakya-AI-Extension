# Android

## Core Principles
- Check `compileSdk`, `minSdk`, `targetSdk` in `build.gradle` before using APIs. Never use APIs below `minSdk` without proper version checks (`Build.VERSION.SDK_INT >= Build.VERSION_CODES.X`).
- Inspect the existing architecture before adding patterns. If the project uses MVVM + Repository, continue with MVVM. Do not introduce MVP or MVC alongside it.
- Never perform network I/O, database operations, or heavy computation on the main (UI) thread — it causes ANR (Application Not Responding).

## Architecture
- Use MVVM with ViewModel + LiveData/StateFlow + Repository pattern.
- ViewModels survive configuration changes (rotation). Never store Activity/Fragment references in ViewModel.
- Use the Repository pattern to abstract data sources (Remote API + local Room database).

## Jetpack Compose vs Views
- Check existing UI code: if it uses XML layouts (`res/layout/`), continue with Views. If it uses `@Composable` functions, use Compose.
- Never mix Compose and legacy Views in the same screen without `ComposeView` / `AndroidView` interop bridges.

## Coroutines
- Use Kotlin Coroutines for all asynchronous work. Use `viewModelScope` in ViewModels, `lifecycleScope` in UI layer.
- Never use `GlobalScope` — it leaks coroutines beyond component lifecycle.

## Security
- Sensitive data (tokens, passwords) must use `EncryptedSharedPreferences` or Android Keystore — never plain `SharedPreferences`.
- Enable network security config to prevent cleartext traffic in production.
- Never log sensitive information (`Log.d("token", userToken)`).

## Permissions
- Request only the permissions necessary. Use runtime permissions for dangerous permissions.
- Handle permission denial gracefully — explain to the user why the permission is needed before requesting.

## Verification Checklist
- [ ] Is `minSdk` checked before using APIs?
- [ ] Is the existing architecture pattern followed?
- [ ] Are no network/database operations on the main thread?
- [ ] Is sensitive data stored in `EncryptedSharedPreferences` or Android Keystore?
- [ ] Is `GlobalScope` avoided?
