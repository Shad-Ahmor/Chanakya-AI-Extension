# Kotlin

## Core Principles
- Check the Kotlin version in `build.gradle` before using language features. Kotlin 1.9 and 2.0 introduce different APIs.
- Use idiomatic Kotlin — leverage null safety, extension functions, data classes, and sealed classes.
- Never use `!!` (non-null assertion) casually — it will throw `NullPointerException` at runtime. Use safe calls `?.`, Elvis operator `?:`, or proper null handling.

## Null Safety
- Use `?.` for safe calls on nullable types.
- Use `?:` (Elvis operator) for fallback values.
- Use `requireNotNull()` or `checkNotNull()` with descriptive messages — not bare `!!`.
- Use `lateinit var` only for non-nullable properties that cannot be initialized at construction time.

## Coroutines
- Use `suspend` functions for asynchronous operations. Use `CoroutineScope` with a lifecycle-bound scope.
- Use `Dispatchers.IO` for I/O operations. Use `Dispatchers.Default` for CPU-intensive work. Never block on `Dispatchers.Main`.
- Cancel coroutines properly — use `CoroutineScope` tied to component lifecycle.

## Data Classes
- Use `data class` for value objects — they auto-generate `equals()`, `hashCode()`, `toString()`, `copy()`.
- Use `sealed class` for exhaustive hierarchies where all subtypes are known at compile time.

## Collections
- Use `listOf()`, `mapOf()`, `setOf()` for immutable collections.
- Use `mutableListOf()`, `mutableMapOf()` only when mutability is required.
- Prefer Kotlin collection extension functions (`filter`, `map`, `flatMap`, `groupBy`) over manual loops.

## Verification Checklist
- [ ] Is the Kotlin version confirmed before using features?
- [ ] Is `!!` avoided — safe calls or Elvis operator used instead?
- [ ] Are coroutines cancelled properly via lifecycle-bound scope?
- [ ] Are `data class` used for value objects?
- [ ] Is `Dispatchers.IO` used for I/O and `Dispatchers.Default` for CPU work?
