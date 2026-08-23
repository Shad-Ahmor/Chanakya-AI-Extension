# Material UI (MUI)

## Core Principles
- Check `package.json` for the MUI version. MUI v5 (`@mui/material`) uses Emotion. MUI v4 (`@material-ui/core`) uses JSS — they are incompatible and cannot be mixed.
- All MUI applications must be wrapped in `<ThemeProvider>` with a defined `createTheme()`.
- Never use MUI components outside a `ThemeProvider`.

## Theme
- Define all design tokens (colors, typography, spacing, breakpoints) in `createTheme()`.
- Use `theme.palette.primary.main`, `theme.spacing(2)` — never hardcode hex values or pixel values that should come from the theme.
- Use `ThemeProvider` at the application root, not per-component.

## Styling
- Use the `sx` prop for one-off instance-level style overrides.
- Use `styled()` for reusable, named component variants.
- Use `useTheme()` hook to access theme values in JavaScript logic.
- Do not mix `sx` prop with legacy `makeStyles()` / `withStyles()` patterns (v4) in new v5 code.

## Component Usage
- Use MUI `<Button>` variants (`contained`, `outlined`, `text`) consistently with the design system.
- Use `<TextField>` with `label`, `helperText`, and `error` props — never custom input elements alongside MUI.
- Use `<Grid>` or `<Stack>` for layout — not margin/padding hacks.

## Accessibility
- MUI components include accessibility by default. Provide `aria-label` on icon buttons.
- Use `<Tooltip>` for icon buttons to provide visible labels on hover.

## Verification Checklist
- [ ] Is the MUI version confirmed (v4 vs v5) before writing code?
- [ ] Is `<ThemeProvider>` wrapping the application?
- [ ] Are design tokens from `createTheme()` — not hardcoded values?
- [ ] Is the styling approach (`sx` vs `styled()`) consistent with the existing codebase?
