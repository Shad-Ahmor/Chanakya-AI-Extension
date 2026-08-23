# JavaScript

## Core Principles
- Check the project's `package.json` for `"type": "module"` (ESM) vs absent/`"commonjs"` (CJS). ESM uses `import`/`export`. CJS uses `require()`/`module.exports`. Never mix them without transpilation.
- Check the project's `tsconfig.json` or Babel config before using newer ECMAScript features.
- Inspect the existing codebase's patterns (async style, error handling, naming conventions) before writing new code.

## Variables & Scoping
- Use `const` by default. Use `let` only when reassignment is required. Never use `var`.
- `const` prevents reassignment — it does not make objects or arrays immutable.
- Use block scoping correctly — `let` and `const` are block-scoped, not function-scoped.

## Types & Equality
- Use `===` (strict equality) and `!==` at all times. Never use `==` — it performs type coercion with non-obvious results.
- Use `typeof value === 'string'` for type guards — never trust variable types from external sources.
- Use `Array.isArray()` to check for arrays — `typeof` returns `'object'` for arrays.

## Async / Promises
- Use `async/await` for all asynchronous code. Avoid `.then()` chains — they are harder to read and harder to error-handle correctly.
- Every `await` must be inside a `try/catch` block. Unhandled promise rejections crash Node.js and silently fail in browsers.
- Never `await` inside a `for` loop when requests are independent — use `Promise.all()` for parallel execution.
- Never use `new Promise()` when an existing API already returns a Promise — it creates unnecessary wrapper nesting.

## Functions
- Use arrow functions for callbacks and short expressions. Use named function declarations for top-level functions (better stack traces).
- Prefer pure functions — same inputs produce same outputs, no side effects.
- Use default parameter values instead of `||` fallbacks: `function fn(x = 0)` not `const x = x || 0` (fails for falsy valid values).

## Objects & Arrays
- Use spread operator (`...`) for shallow object and array copies — never mutate function arguments.
- Use destructuring for extracting values from objects and arrays.
- Use `Object.freeze()` for truly immutable object constants.
- Use `Map` instead of plain objects as key-value stores when keys are non-string or need ordered iteration.
- Use `Set` for unique collections instead of array deduplication tricks.

## Classes
- Use `class` syntax for object blueprints. Use `#field` private class fields (native, ES2022) over naming conventions.
- Use `static` for utility methods that do not require instance state.

## Modules (ESM)
- Named exports: `export function foo()`. Named imports: `import { foo } from './module.js'`.
- Default exports: use sparingly — they are harder to refactor and do not enforce naming consistency.
- Always include file extensions in import paths for ESM in Node.js: `import { fn } from './utils.js'`.

## Security
- Never use `eval()` or `new Function(string)` — they execute arbitrary strings as code and are a critical XSS/RCE vector.
- Never use `innerHTML` with user-supplied content — use `textContent` or proper DOM APIs.
- Sanitize user input before rendering to the DOM. Use `DOMPurify` for rich HTML content.
- Use `crypto.randomUUID()` or `crypto.getRandomValues()` for secure random values — never `Math.random()`.

## Error Handling
- Always throw `Error` instances — never throw strings: `throw new Error('message')`.
- Create custom error classes extending `Error` for domain-specific errors.
- Use `finally` for cleanup that must happen regardless of success or failure.

## Performance
- Avoid unnecessary object allocations in hot paths (tight loops, render functions).
- Use `DocumentFragment` for batch DOM insertions — avoid repeated individual `appendChild` calls.
- Debounce/throttle event handlers that fire at high frequency (scroll, resize, input).

## Verification Checklist
- [ ] Is the module system (ESM vs CJS) confirmed before writing import/export statements?
- [ ] Is `===` used throughout — no `==` comparisons?
- [ ] Is every `await` wrapped in `try/catch`?
- [ ] Is `Promise.all()` used for independent parallel async operations?
- [ ] Is `eval()` and `innerHTML` with user content avoided?
- [ ] Are `const` / `let` used — never `var`?
- [ ] Are user-supplied values sanitized before DOM insertion?
