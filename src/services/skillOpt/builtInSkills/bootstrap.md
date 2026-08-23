# Bootstrap

## Core Principles
- Check the installed Bootstrap version in `package.json` or CDN link before writing markup. Bootstrap 4 and Bootstrap 5 have incompatible class names (`ml-`/`mr-` vs `ms-`/`me-`, `float-left` vs `float-start`).
- Never introduce Bootstrap into a project already using Tailwind CSS or another CSS framework.
- Use Bootstrap utilities instead of writing custom CSS for spacing, typography, and display.

## Version Differences (4 vs 5)
- Bootstrap 5: No jQuery dependency. Uses vanilla JavaScript.
- Bootstrap 5: `ms-*`/`me-*` (start/end) instead of `ml-*`/`mr-*` (left/right).
- Bootstrap 5: `g-*` gutter utilities instead of `no-gutters` class.
- Bootstrap 4: Requires jQuery and Popper.js.

## Customization
- Customize via Sass variables (`$primary`, `$font-size-base`) — not by overriding compiled CSS.
- Use `_custom.scss` that imports Bootstrap's source and overrides variables before the import.
- Never modify `bootstrap.css` or `bootstrap.min.css` directly.

## Grid System
- Use the 12-column grid system with `col-*` breakpoints: `col-sm-*`, `col-md-*`, `col-lg-*`, `col-xl-*`.
- Always nest columns inside a `row`, and rows inside a `container` or `container-fluid`.

## Accessibility
- Use Bootstrap's built-in accessible components (modals, dropdowns) — they include ARIA attributes.
- Always provide `aria-label` on icon-only buttons.

## Verification Checklist
- [ ] Is the Bootstrap version confirmed before writing markup?
- [ ] Are Bootstrap 4 and Bootstrap 5 class names not mixed?
- [ ] Is Bootstrap the only CSS framework in the project?
- [ ] Are customizations via Sass variables — not overriding compiled CSS?
