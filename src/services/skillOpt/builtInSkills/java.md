# Java

## Core Principles
- Check the Java version (`java -version`) and the project's `pom.xml` or `build.gradle` before using language features. Java 17+ features (records, sealed classes, pattern matching) are unavailable in Java 11.
- Follow existing project structure — Spring Boot, Quarkus, Jakarta EE, plain Maven/Gradle.
- Use the existing build system. Never introduce Maven in a Gradle project or vice versa.

## Modern Java Features
- Java 16+: Use `record` for immutable data carriers instead of boilerplate POJOs.
- Java 17+: Use sealed classes to restrict class hierarchies.
- Java 21+: Use virtual threads (Project Loom) for high-concurrency I/O without blocking platform threads.
- Always use `var` only where the type is obvious from context — not for every variable.

## Null Safety
- Use `Optional<T>` for return values that may be absent. Never return `null` from a public API method.
- Annotate parameters and return types with `@NonNull` / `@Nullable` (Lombok or JSR-305).

## Collections
- Use immutable collections (`List.of()`, `Map.of()`, `Set.of()`) for fixed data.
- Never return mutable internal collections — return defensive copies or unmodifiable views.
- Use `Stream` API for functional transformations over collections.

## Security
- Never use `Runtime.exec()` or `ProcessBuilder` with unsanitized user input.
- Use `PreparedStatement` for all SQL — never string concatenation.
- Use `SecureRandom` for cryptographic operations — never `Random`.

## Verification Checklist
- [ ] Is the Java version confirmed in `pom.xml` / `build.gradle` before using features?
- [ ] Are `Optional<T>` used instead of returning `null`?
- [ ] Are all SQL queries using `PreparedStatement`?
- [ ] Is `SecureRandom` used for cryptographic values?
