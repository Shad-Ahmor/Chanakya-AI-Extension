# Next.js

## Core Principles
- Determine whether the project uses `app/` (App Router, Next.js 13+) or `pages/` (Pages Router) before writing any code. They have incompatible data-fetching patterns and component models. Never mix them.
- Check the installed Next.js version in `package.json` before using version-specific features.
- Never commit secrets without `NEXT_PUBLIC_` prefix to client-accessible env vars.

## App Router (Next.js 13+)
- Components are Server Components by default. Only add `'use client'` when the component requires browser APIs, event handlers, or hooks.
- Keep the client boundary as far down the component tree as possible.
- Fetch data in Server Components using native `async/await` — no `useEffect` + `useState` for data fetching.
- Use `cache()`, `revalidate`, and `unstable_cache` for caching control.
- Validate and authorize every Server Action — they are exposed as API endpoints.

## Pages Router (Pre-13)
- Use `getServerSideProps` for server-rendered pages requiring fresh data per request.
- Use `getStaticProps` + `getStaticPaths` for static pages with precomputed paths.
- Use `getStaticProps` with `revalidate` for ISR (Incremental Static Regeneration).
- Use `getServerSideProps` only when static generation is not possible — it adds server load per request.

## Environment Variables
- `NEXT_PUBLIC_*`: Embedded in the browser bundle. Safe only for public, non-sensitive values.
- All other env vars: Server-only. Never accessible in client components.
- Never prefix API keys, database URLs, or service secrets with `NEXT_PUBLIC_`.

## API Routes
- API routes run on the server. Implement auth and input validation in every route handler.
- Use correct HTTP status codes. Never return `200` with an error body.

## Image Optimization
- Always use `next/image` `<Image>` component for automatic format conversion (WebP), responsive sizing, and lazy loading.

## Verification Checklist
- [ ] Is the Router type (App or Pages) confirmed before writing code?
- [ ] Is the Next.js version confirmed in `package.json`?
- [ ] Are secrets never prefixed with `NEXT_PUBLIC_`?
- [ ] Do Server Actions validate and authorize input?
- [ ] Is `next/image` used for all image elements?
