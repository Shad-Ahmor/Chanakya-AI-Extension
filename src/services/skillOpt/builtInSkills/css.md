# CSS

## Core Principles
- Follow the existing project's CSS methodology (BEM, CSS Modules, CSS-in-JS, utility-first). Never introduce a second methodology.
- Never use `!important` — fix the specificity problem instead.
- Never use inline styles in production — they cannot be overridden by media queries and bypass the cascade.

## Selectors
- Keep selector specificity as low as possible. Use class selectors (`.btn`) over element selectors (`button`) over ID selectors (`#submit`).
- Avoid deeply nested selectors — they increase specificity and reduce reusability.

## Layout
- Use CSS Grid for two-dimensional layouts. Use Flexbox for one-dimensional layouts (row or column).
- Use `gap` instead of margins between flex/grid children.
- Use `min-width` media queries for mobile-first responsive design.

## Custom Properties (Variables)
- Define design tokens as CSS custom properties on `:root`:
```css
:root {
    --color-primary: hsl(220, 90%, 56%);
    --spacing-md: 1rem;
}
```
- Use variables for all repeated values — colors, spacing, typography.

## Performance
- Use `will-change` sparingly — only for elements with known animations that benefit from GPU compositing.
- Use `content-visibility: auto` for off-screen content sections to improve rendering performance.
- Use `transform` and `opacity` for animations — they trigger GPU compositing, not layout recalculation.

## Dark Mode
- Use `@media (prefers-color-scheme: dark)` or a `.dark` class on `<html>` for theme switching.
- Define dark mode color tokens as CSS custom property overrides.

## Verification Checklist
- [ ] Is the existing CSS methodology followed — not a new one introduced?
- [ ] Is `!important` absent?
- [ ] Are inline styles avoided in production?
- [ ] Are design tokens defined as CSS custom properties?
- [ ] Is mobile-first responsive design used (`min-width` media queries)?
