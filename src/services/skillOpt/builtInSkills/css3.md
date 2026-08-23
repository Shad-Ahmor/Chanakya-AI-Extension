# CSS3

## Core Principles
- Check browser support requirements before using modern CSS3 features. Use caniuse.com to verify support for the target browsers.
- Use progressive enhancement — base styles work in all browsers, enhanced with modern CSS where supported.

## Modern Layout
- CSS Grid: Two-dimensional layouts. `display: grid`, `grid-template-columns`, `grid-template-areas`.
- Flexbox: One-dimensional layouts. `display: flex`, `flex-direction`, `align-items`, `justify-content`.
- Container Queries (`@container`): Style components based on parent container size — not viewport size. Available in all modern browsers since late 2023.
- `:has()` pseudo-class: Style a parent based on its children. Available in all modern browsers since 2023.

## Animations & Transitions
- Use `transition` for state-change animations (hover, focus). Specify only the properties that change — not `all`.
- Use `@keyframes` + `animation` for looping or complex multi-step animations.
- Respect `prefers-reduced-motion` — wrap non-essential animations:
```css
@media (prefers-reduced-motion: no-preference) {
    .element { animation: slide-in 0.3s ease; }
}
```

## Modern Selectors
- `:is()`, `:where()`: Group selectors with varying specificity implications.
- `:not()`: Exclude elements from a rule.
- `:focus-visible`: Style focus rings only for keyboard navigation — not mouse clicks.

## Scroll
- `scroll-snap-type` / `scroll-snap-align`: CSS-native carousel/slider behavior.
- `scroll-behavior: smooth`: Smooth scrolling for anchor links (override with `prefers-reduced-motion`).

## Verification Checklist
- [ ] Is browser support verified for modern CSS3 features being used?
- [ ] Is `prefers-reduced-motion` respected for animations?
- [ ] Is `:focus-visible` used for keyboard-only focus styles?
