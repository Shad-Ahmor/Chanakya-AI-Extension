# Node.js

## Core Principles
- Check `package.json` for the Node.js version (`engines.node`) and installed dependencies before using APIs or introducing new packages.
- Never use synchronous blocking methods (`fs.readFileSync`, `execSync`) in request handlers — they block the event loop for all concurrent requests.
- Unhandled promise rejections crash the Node.js process. Every `async` function must have a `try/catch` or `.catch()`.

## Event Loop
- The event loop is single-threaded. CPU-intensive work blocks all other requests.
- Offload CPU-intensive work to Worker Threads (`worker_threads`) or a separate process.
- Use `setImmediate()` to defer non-critical work after I/O callbacks.

## Modules
- Use ESM (`import`/`export`) for new projects. Check `package.json` `"type": "module"` field.
- Never use `require()` in ESM projects. Never use `import` in CJS projects without transpilation.
- Never expose internal modules or sensitive file paths via the module system.

## Error Handling
- Every `async` function must use `try/catch`. Every `EventEmitter` must handle the `error` event.
- Use a process-level `uncaughtException` and `unhandledRejection` handler for logging only — always exit the process after these events.
- Define a centralized error class hierarchy.

## Security
- Never use `child_process.exec()` with user-supplied input — use `child_process.execFile()` with argument arrays.
- Never use `eval()` or `new Function(string)`.
- Use `helmet` middleware for HTTP security headers.
- Use `crypto.randomBytes()` for cryptographically secure random values — never `Math.random()` for tokens.

## Performance
- Use connection pooling for all database access.
- Use streaming (`fs.createReadStream`, `response.pipe()`) for large file operations.
- Use `cluster` module or a process manager (PM2) for multi-core utilization.

## Environment Variables
- Use `dotenv` to load `.env` files in development. Never commit `.env` to version control.
- Validate required environment variables on startup — fail fast if critical config is missing.

## Verification Checklist
- [ ] Is the Node.js version checked before using APIs?
- [ ] Are all async operations using `async/await` with `try/catch`?
- [ ] Are no synchronous blocking methods used in request handlers?
- [ ] Is user input never passed to `child_process.exec()`?
- [ ] Are all environment secrets loaded from environment variables — not hardcoded?
