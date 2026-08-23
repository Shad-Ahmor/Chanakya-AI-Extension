# GraphQL

## Core Principles
- Inspect the existing SDL/schema before writing or modifying any resolver. A resolver must match the shape its type declares.
- The schema is a strict contract. Breaking changes (removing fields, changing types, making nullable fields non-nullable) affect all clients.
- Authorization must be checked in every resolver before executing business logic or database queries.

## Schema Design
- Types: `PascalCase`. Fields: `camelCase`. Queries: verb-less nouns (`user`, `users`). Mutations: `verbNoun` (`createUser`). Enums: `SCREAMING_SNAKE_CASE`.
- Mark fields as non-null (`!`) only when you can guarantee they will never be null. A non-null field returning null propagates error up the chain.
- Use named `input` types for mutation arguments — never inline scalar arguments.
- Use custom scalars (`Date`, `EmailAddress`, `UUID`) rather than `String` for domain-specific types.

## Resolvers
- Resolver signature: `(parent, args, context, info)`. Put per-request dependencies (auth user, DataLoaders, DB) in `context`.
- Thin resolvers: validate, authorize, call a service, return result. Business logic belongs in services, not resolvers.
- Interfaces and unions MUST implement `__resolveType` — without it GraphQL cannot determine the concrete type.

## Authorization
- Resolve the authenticated user once in the context factory. Resolvers read from `context.user` — they do not authenticate themselves.
- Apply authorization in every resolver that returns sensitive data. Do not assume top-level auth protects child resolvers.
- Never trust client-provided user IDs or roles in variables as proof of identity.

## N+1 Problem & DataLoader
- The N+1 problem: a list query returning N objects with a per-item database resolver executes N+1 queries.
- Use DataLoader to batch and cache database calls within a single request.
- Create DataLoader instances per-request in the context factory — never share across requests.
- The DataLoader batch function must return results in the EXACT same order as the input keys array.

## Pagination
- Implement cursor-based pagination using the Relay Connection Specification (`edges`, `node`, `cursor`, `pageInfo`).
- Never expose a list field without mandatory pagination arguments.

## Security
- Disable introspection in production: `introspection: process.env.NODE_ENV !== 'production'`.
- Implement query depth limiting and complexity analysis to prevent DoS via deeply nested queries.
- Use variables for all dynamic values — never interpolate into query strings.
- Sanitize operator usage in dynamically constructed queries (MongoDB `$where` via a GraphQL argument is still injection).

## Variables
- Always use GraphQL variables for dynamic values — never interpolate into query strings.
- Variables are type-validated by the schema before the resolver is called.

## Testing
- Test resolvers in isolation with mocked `context`, `parent`, and `args`.
- Write explicit tests for authorization — test that unauthenticated requests are rejected and role-based access is enforced.

## Verification Checklist
- [ ] Has the existing SDL/schema been read before writing or modifying a resolver?
- [ ] Does every resolver check `context.user` before executing business logic?
- [ ] Are DataLoader instances created per-request in the context factory?
- [ ] Is introspection disabled in production?
- [ ] Do mutations accept `input` types — not inline scalars?
- [ ] Do list fields enforce pagination?
- [ ] Are GraphQL variables used for all dynamic values?
- [ ] Do interfaces and unions implement `__resolveType`?
