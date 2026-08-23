# Web Development

## Core Principles
- Inspect the existing project stack before introducing anything new. Read `package.json`, framework config files, and directory structure. Never introduce a technology that duplicates something already present.
- Avoid unnecessary rewrites. Only refactor when there is a specific, articulable problem to fix.
- Preserve existing conventions — naming, folder structure, state management pattern, import style.

## Architectural Decision Making

### Frontend vs Backend
- **Frontend**: Rendering, UI interaction, form handling, client-side routing, presentation logic. Runs in browser.
- **Backend**: Business logic, database access, authentication, third-party API calls requiring secret keys. Runs on a server.
- Any logic requiring secret credentials, database access, or sensitive computation must live on the backend.

### SSR vs CSR
- **CSR**: Highly interactive dashboards, authenticated apps, user-specific data.
- **SSR**: SEO-critical pages, real-time data, reducing Time to First Contentful Paint.
- **SSG**: Rarely-changing content (marketing, docs, blogs). Fastest delivery via CDN.
- Default to SSG for public content-driven pages. Use SSR only for real-time server data.

### Component vs Service
- Component: renders UI, receives data via props, no business logic or API calls.
- Service/Hook: orchestrates data, fetches, transforms, manages shared state — no rendering.
- Mix only at the page/route level.

### State vs Server Data
- **Client State**: UI state that exists only in browser — modal open/closed, form draft, tab selection.
- **Server State**: Data that originates on server, needs to be fresh — user profile, orders. Use React Query, SWR, or Apollo.
- Never copy server data into `useState` unnecessarily.

### Authentication vs Authorization
- **Authentication**: Proving who you are — login, JWT validation, session verification.
- **Authorization**: What you are allowed to do — role checks, capability checks, ownership verification.
- Authentication happens first on every request. Authorization is evaluated after, per action. Both enforced server-side.

## HTML
- Use semantic HTML elements — `<nav>`, `<main>`, `<article>`, `<section>`, `<button>`, `<a>`.
- Single `<h1>` per page. Heading hierarchy must be logical — never skip levels for styling.
- Always provide `alt` attributes on images. Use `loading="lazy"` for below-the-fold images.

## CSS
- Follow the existing project convention (BEM, CSS Modules, CSS-in-JS). Never mix strategies.
- Use `min-width` media queries for mobile-first design.
- Use CSS custom properties for theming tokens. Avoid `!important`. Avoid inline styles in production.

## CSS Framework Decision
- If Tailwind is present, use Tailwind. If Bootstrap is present, use Bootstrap. Never introduce a second framework alongside an existing one.
- Tailwind v3 and v4 have different configuration — check version before using utilities.
- Bootstrap 4 and 5 have incompatible class names — check version.

## JavaScript
- Use `const` by default. `let` only when reassignment is required. Never `var`.
- Use `async/await`. Wrap every `await` in `try/catch`. Use `===` always.
- Never use `eval()` or `new Function(string)` — critical XSS vector.

## React
- Before adding `useState`, determine if the value is derived state, server data, or true local UI state.
- `useEffect` is for synchronizing with external systems — not for data fetching in modern React.
- Every `.map()` item needs a stable, unique `key` prop. Never use array index for reorderable lists.
- Prop drilling more than 2 levels deep: use Context, Zustand, or the project's established pattern.

## Next.js
- Determine: `app/` (App Router) or `pages/` (Pages Router) — never mix.
- Server Components by default in App Router. Only add `'use client'` when the component needs browser APIs, event handlers, or client-side state.
- Prefix client-accessible env vars with `NEXT_PUBLIC_`. Never prefix secrets with `NEXT_PUBLIC_`.
- Validate and authorize every Server Action — they are exposed as API endpoints.

## REST APIs
- Use correct HTTP methods: `GET` (read), `POST` (create), `PUT` (replace), `PATCH` (partial update), `DELETE`.
- Return semantically correct status codes. Never return `200` with an error body.
- Never expose database connection strings from client-side code.

## Security
- Set `Content-Security-Policy` header. Enforce HTTPS. Redirect HTTP to HTTPS.
- Sanitize all user input before rendering (escape XSS). Parameterize all database queries (prevent injection).
- Store auth tokens in `httpOnly`, `Secure`, `SameSite=Strict` cookies — not `localStorage`.
- Run `npm audit` before releases.

## Accessibility
- Every interactive element must be operable with keyboard alone.
- Move focus into modals when they open. Return focus to trigger on close.
- Ensure text meets WCAG AA contrast ratios (4.5:1 normal text, 3:1 large text).

## Performance
- Optimize for Core Web Vitals: LCP < 2.5s, INP < 200ms, CLS < 0.1.
- Use dynamic `import()` for route-level code splitting.
- Use Next.js `<Image>` or equivalent for format conversion, responsive sizes, lazy loading.
- Use `React.memo`, `useMemo`, `useCallback` deliberately — only where memoized computation is genuinely expensive.

## Deployment
- Never commit secrets or environment config to version control.
- Always run `npm run build` in CI before deployment. Successful dev server ≠ successful production build.
- Expose a `/health` endpoint returning `200 OK` for load balancer health checks.

## Verification Checklist
- [ ] Has `package.json` been inspected before adding any new library?
- [ ] Does new code follow existing project naming and folder conventions?
- [ ] Is all sensitive logic (database, secrets, auth) on the server — never in client code?
- [ ] Is user input validated on the server before use?
- [ ] Is user output escaped before rendering in HTML?
- [ ] Are HTTP status codes semantically correct?
- [ ] Are all interactive elements keyboard-accessible?
- [ ] Has `npm audit` been run with no high-severity vulnerabilities?
- [ ] Does `npm run build` pass without errors?
- [ ] Are environment secrets stored outside version control?
