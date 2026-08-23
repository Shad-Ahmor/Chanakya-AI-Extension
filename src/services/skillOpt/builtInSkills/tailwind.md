# Tailwind CSS

## Core Principles
- Check `package.json` for the installed Tailwind version. Tailwind v3 and v4 have different configuration approaches.
- Never introduce Tailwind into a project already using Bootstrap, Material UI, or another CSS framework.
- Prefer theme tokens over arbitrary values (`bg-primary` over `bg-[#3b82f6]`).

## Version Check
- Tailwind v3: `tailwind.config.js` or `tailwind.config.ts` with `content`, `theme`, `plugins` keys.
- Tailwind v4: CSS-first configuration with `@import "tailwindcss"` in CSS file. No `tailwind.config.js` needed.
- Check `content` array in v3 config to ensure template paths are included — missing paths mean classes are purged.

## Configuration
- Read `tailwind.config.js` for customized theme tokens before using arbitrary values.
- Extend the theme rather than replacing it: `theme: { extend: { colors: { ... } } }`.

## Component Extraction
- When a utility combination is used more than 3 times, extract it into a reusable component — not a CSS class.
- Use `@apply` in CSS files sparingly and only for truly reusable base styles (buttons, badges).

## Dark Mode
- Check `darkMode` configuration: `'media'` (OS preference) or `'class'` (manual toggle).
- Use `dark:` prefix consistently for dark mode variants.

## Responsive Design
- Tailwind is mobile-first. Unprefixed utilities apply to all sizes. Use `sm:`, `md:`, `lg:`, `xl:` to override at larger breakpoints.

## Verification Checklist
- [ ] Is the Tailwind version confirmed before using utilities?
- [ ] Is Tailwind the only CSS framework in the project?
- [ ] Are theme tokens used instead of arbitrary values where possible?
- [ ] Is the `content` array in `tailwind.config.js` covering all template paths?
