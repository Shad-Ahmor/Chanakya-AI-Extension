# Express.js

## Core Principles
- Inspect the existing middleware stack before adding new middleware. Check the order of `app.use()` calls — order is significant in Express.
- Validate and sanitize all request body, query, and parameter values before using in business logic or database queries.
- Implement a central error handler as the LAST `app.use()` with signature `(err, req, res, next)`.

## Middleware Order
- `helmet()` → CORS → body parsing → auth → routes → 404 handler → error handler.
- Auth middleware must run before any route that requires authentication.
- Never call `next()` after sending a response — it causes "Cannot set headers after they are sent" errors.

## Input Validation
- Use Joi, Zod, Yup, or express-validator for all request validation.
- Validate `req.body`, `req.query`, `req.params` explicitly. Never trust client-supplied data.

## Async Routes
- Express 4 does not catch async errors automatically. Wrap async handlers:
```js
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
```

## Security
- Configure CORS with explicit `origin` allowlist. Never use `cors()` with `origin: *` for authenticated endpoints.
- Set `ProxyRequests Off` equivalent — never allow the Express app to be used as an open proxy.
- Use `express-rate-limit` for rate limiting on all public endpoints.
- Never return stack traces or internal error details to clients in production.

## Error Handling
- Use a single central error handler. Set `NODE_ENV=production` to suppress stack traces in responses.

## Verification Checklist
- [ ] Is the existing middleware stack inspected before adding new middleware?
- [ ] Is all user input validated before use in business logic?
- [ ] Are async route handlers wrapped for error catching?
- [ ] Is CORS configured with an explicit origin allowlist?
- [ ] Are stack traces suppressed in production error responses?
