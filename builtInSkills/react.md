# React

## Core Principles
- Inspect existing component structure and state management patterns before adding new ones. If the project uses Redux, use Redux. If it uses Zustand, use Zustand. Never introduce a second state management library.
- Prefer functional components and hooks. Class components are legacy — never write new class components.
- One component, one responsibility. A component that fetches, transforms, and renders complex UI should be split.

## Components
- Keep components pure — same props produce same output.
- Use `React.memo` for expensive pure components that receive stable props. Do not memoize everything.
- Co-locate component files with their styles, tests, and subcomponents.

## Hooks
- `useState`: Local UI state only. Not for derived values or server data.
- `useEffect`: For synchronizing with external systems (subscriptions, DOM APIs, timers). Not for data fetching in modern React — use React Query or SWR.
- `useMemo`: For expensive computations. Verify the computation is genuinely expensive before memoizing.
- `useCallback`: For stable function references passed as props to memoized children.
- `useRef`: For DOM references and values that must persist across renders without triggering re-renders.
- Every `useEffect` must have a correct, complete dependency array.

## Keys in Lists
- Every `.map()` rendered item MUST have a stable, unique `key` prop.
- Never use array index as `key` for lists that can be reordered or filtered.

## State Management
- Local UI state: `useState` / `useReducer`.
- Shared UI state: React Context (for low-frequency updates) or Zustand/Jotai/Recoil.
- Server state: React Query, SWR, or Apollo — never copy server data into `useState`.
- Prop drilling more than 2 levels: use Context or a state library.

## Performance
- Use `React.lazy` + `Suspense` for route-level code splitting.
- Avoid anonymous functions as event handlers in JSX — they create new references on every render.
- Use `useTransition` and `useDeferredValue` for non-urgent state updates in React 18+.

## Security
- Never use `dangerouslySetInnerHTML` with user-supplied content without sanitization (`DOMPurify`).
- Never `eval()` strings received from APIs.

## Verification Checklist
- [ ] Is the existing state management pattern inspected and preserved?
- [ ] Are components functional — no new class components?
- [ ] Do all `.map()` calls have stable, unique `key` props?
- [ ] Is `useEffect` used only for external system synchronization — not data fetching?
- [ ] Is server data managed by a data-fetching library, not copied into `useState`?
- [ ] Is `dangerouslySetInnerHTML` avoided or properly sanitized?
