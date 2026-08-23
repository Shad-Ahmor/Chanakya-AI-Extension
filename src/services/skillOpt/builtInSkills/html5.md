# HTML5

## Core Principles
- Use semantic HTML elements for their intended purpose — not for visual effect alone.
- One `<h1>` per page. Heading hierarchy must be logical and not skip levels.
- All user-facing text must be readable by screen readers.

## Semantic Elements
- `<header>`, `<footer>`: Page-level or section-level header/footer.
- `<nav>`: Primary navigation links.
- `<main>`: Main content of the page. Only one per page.
- `<article>`: Self-contained content (blog post, news item).
- `<section>`: Thematic grouping of content with a heading.
- `<aside>`: Supplementary content related to the main content.
- `<figure>` / `<figcaption>`: Images, diagrams, code blocks with captions.
- Never use `<div>` or `<span>` when a semantic element applies.

## Forms
- Every `<input>` must have an associated `<label>` linked via `for`/`id`.
- Use `type="email"`, `type="tel"`, `type="number"`, `type="date"` for correct mobile keyboards and validation.
- Use `autocomplete` attributes for common fields: `autocomplete="email"`, `autocomplete="name"`.
- Use `required`, `minlength`, `maxlength`, `pattern` for client-side validation (always also validate server-side).

## Images
- Always provide `alt` attributes. Empty `alt=""` for decorative images.
- Use `loading="lazy"` for below-the-fold images.
- Use `srcset` and `sizes` for responsive images.
- Use `<picture>` element for art direction or format switching (WebP with JPEG fallback).

## Accessibility
- Use `role` attributes only when semantic HTML does not convey the necessary meaning.
- Provide `aria-label` for icon-only buttons: `<button aria-label="Close menu">`.
- Use `aria-expanded`, `aria-controls`, `aria-hidden` for interactive patterns.

## Security
- Never render user-supplied HTML without sanitization.
- Use `rel="noopener noreferrer"` on `target="_blank"` links to prevent tab-napping.

## Verification Checklist
- [ ] Is there exactly one `<h1>` per page?
- [ ] Are semantic elements used instead of generic `<div>` where applicable?
- [ ] Does every `<input>` have an associated `<label>`?
- [ ] Do all images have `alt` attributes?
- [ ] Are `target="_blank"` links using `rel="noopener noreferrer"`?
