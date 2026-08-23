# Flutter

## Core Principles
- Check `pubspec.yaml` for the Flutter SDK version and installed packages before using features or adding dependencies.
- Inspect existing state management approach (`Provider`, `Riverpod`, `BLoC`, `GetX`) before writing state logic. Never introduce a second state management library.
- Never perform heavy computation on the main isolate — use `Isolate.run()` or `compute()` to offload.

## State Management
- Follow the existing pattern rigorously. Each pattern has specific conventions:
  - **Riverpod**: Use providers and `ref.watch()` / `ref.read()` correctly.
  - **BLoC**: Events -> BLoC -> States. Never put business logic directly in widgets.
  - **Provider**: Use `ChangeNotifier` or `ValueNotifier` with `Consumer` / `context.watch()`.

## Widgets
- Prefer `const` constructors for widgets that do not depend on runtime values — reduces rebuilds.
- Use `StatelessWidget` where possible. Use `StatefulWidget` only when local mutable state is genuinely needed.
- Break large `build()` methods into smaller extracted `Widget`s or helper methods for readability.

## Navigation
- Check existing navigation approach: `Navigator 1.0` (imperative) vs `go_router` / `auto_route` (declarative). Follow the established approach.

## Performance
- Use `ListView.builder()` for long lists — never `ListView(children: items.map(...).toList())` which builds all items at once.
- Use `RepaintBoundary` around expensive custom painters.

## Security
- Store sensitive data using `flutter_secure_storage` — never in `SharedPreferences`.
- Use `https` for all network requests. Enable certificate pinning for high-security apps.

## Verification Checklist
- [ ] Is the Flutter SDK version and pubspec checked before using features?
- [ ] Is the existing state management pattern followed?
- [ ] Are `const` constructors used where possible?
- [ ] Is `ListView.builder()` used for long lists?
- [ ] Is sensitive data stored in `flutter_secure_storage`?
