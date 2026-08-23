# React Native

## Core Principles
- Check `package.json` for the React Native version and whether the project uses Expo or bare React Native workflow. They have different capabilities and APIs.
- Inspect the existing navigation library (`React Navigation`, `Expo Router`, `React Native Navigation`) before adding routes. Never introduce a second navigation library.
- Never perform heavy computation on the JS thread — use `react-native-reanimated` for animations and Worklets for thread-safe operations.

## Expo vs Bare Workflow
- **Expo Managed**: Limited to Expo SDK APIs. Adding native modules requires ejecting.
- **Expo Bare**: Full access to native code alongside Expo tooling.
- **Bare React Native**: Full control. Native modules added via `pod install` (iOS) and `./gradlew` (Android).

## Performance
- Use `FlatList` or `SectionList` for long lists — never `ScrollView` with `.map()` for large datasets.
- Use `useCallback` and `React.memo` for list item components to prevent unnecessary re-renders.
- Use `react-native-reanimated` for 60fps animations on the UI thread.

## Platform-Specific Code
- Use `Platform.OS === 'ios'` / `'android'` for runtime platform checks.
- Use `.ios.tsx` and `.android.tsx` file extensions for platform-specific implementations.

## Security
- Store sensitive data using `react-native-keychain` or `expo-secure-store` — never `AsyncStorage`.
- Enable certificate pinning for high-security API communication.

## Permissions
- Request permissions at the time they are needed, with a clear explanation.
- Handle denied permissions gracefully.

## Verification Checklist
- [ ] Is the RN version and workflow (Expo/bare) confirmed?
- [ ] Is the existing navigation library used — not a new one introduced?
- [ ] Is `FlatList` used for long lists — not `ScrollView` + `.map()`?
- [ ] Is sensitive data stored in `react-native-keychain` or `expo-secure-store`?
