# Angular

## Core Principles
- Check the Angular version in `package.json` before using features. Angular 17+ uses signals and standalone components — patterns differ from earlier versions.
- Follow the existing project structure: module-based vs standalone, OnPush vs Default change detection.
- Never bypass Angular's dependency injection system with `new ServiceClass()`.

## Components
- Use `OnPush` change detection strategy for performance — components only re-render when input references change or events fire.
- Keep components thin — data fetching belongs in services, not in component classes.
- In Angular 17+, prefer standalone components and functional guards over NgModules when the project uses the standalone approach.

## Services & Dependency Injection
- Use `providedIn: 'root'` for singleton services. Use component-level providers for services scoped to a component subtree.
- Inject services via constructor injection — never instantiate with `new`.

## Observables & RxJS
- Always unsubscribe from Observables to prevent memory leaks. Use `takeUntilDestroyed()` (Angular 16+) or `async` pipe in templates.
- Prefer the `async` pipe in templates — it handles subscription and unsubscription automatically.
- Use `catchError` operator for error handling in Observable chains — never let errors propagate unhandled.

## Security
- Angular automatically escapes bound values in templates — never bypass with `bypassSecurityTrustHtml()` for user-supplied content.
- Use Angular's `HttpClient` for all HTTP requests — it handles XSRF token injection automatically.

## Verification Checklist
- [ ] Is the Angular version confirmed before using features?
- [ ] Are Observables unsubscribed via `async` pipe or `takeUntilDestroyed()`?
- [ ] Is `bypassSecurityTrustHtml()` avoided for user-supplied content?
- [ ] Are services injected via DI — never instantiated with `new`?
