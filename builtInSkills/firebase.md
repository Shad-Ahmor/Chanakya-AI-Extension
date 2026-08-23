# Firebase

## Core Principles
- **Client SDK vs Admin SDK**: This is the most critical rule. Client SDK (`firebase/app`) runs in the browser, is subject to Security Rules, authenticates as an end user. Admin SDK (`firebase-admin`) runs server-side ONLY, bypasses all Security Rules, authenticates as a service account.
- **Never include Admin SDK or service account credentials in any frontend code.**
- Security Rules are the last line of defense. Never use `allow read, write: if true` in production.

## Client SDK vs Admin SDK
- **Client SDK**: Browser, React Native, Flutter apps. Constrained by Security Rules. Uses public Firebase config (safe in client code).
- **Admin SDK**: Cloud Functions, Node.js servers, CI/CD only. Requires service account key — never in frontend.
- Before writing Firebase code, identify whether the execution context is client or server and use the correct SDK.

## Firebase Authentication
- Use `onAuthStateChanged(auth, callback)` — never read `auth.currentUser` synchronously on startup.
- Set custom claims server-side via Admin SDK's `setCustomUserClaims()`. Claims are accessible in Security Rules via `request.auth.token.claimName`.
- Verify ID tokens server-side using `admin.auth().verifyIdToken(idToken)` — never trust client-decoded tokens.

## Firestore
- Use explicit collection paths. Firestore queries are shallow — only documents in the specified collection, not subcollections.
- Composite indexes must be defined in `firestore.indexes.json`. Run `firebase deploy --only firestore:indexes`.
- Use `runTransaction()` when a write depends on reading current values. Use `writeBatch()` for atomic independent writes.
- Use cursor-based pagination (`startAfter(lastDoc)` with `limit()`). There is no `skip()` in Firestore.
- Use `getCountFromServer(query)` for efficient counts — never fetch all documents to count.

## Security Rules
- Rules deny all access by default. You must explicitly grant access.
- Always check `request.auth != null` before accessing `request.auth.uid`.
- Test all rules with `@firebase/rules-unit-testing` before deploying.
- Never use `allow read, write: if true` in production.

## Cloud Functions
- Use Admin SDK inside functions — they run in trusted server environments.
- Design functions to be idempotent — at-least-once delivery means the same event may fire multiple times.
- Declare SDK initializations at module level outside the handler for warm instance reuse.
- Store secrets in Secret Manager (v2) or Firebase Functions config — never hardcode.

## Configuration & Credentials
- Firebase client config (`apiKey`, `projectId`, etc.) is safe in client code — access is controlled by Security Rules.
- Service account JSON files must never be committed to version control. Load via `GOOGLE_APPLICATION_CREDENTIALS` env var.
- In Cloud-hosted environments (Cloud Run, App Engine), use Application Default Credentials — `admin.initializeApp()` without explicit credentials.

## Verification Checklist
- [ ] Is Admin SDK used exclusively in server-side code — never in browser/client code?
- [ ] Are service account keys stored outside version control?
- [ ] Are Security Rules explicitly written and tested for every collection/path?
- [ ] Is `allow read, write: if true` absent from all production Security Rules?
- [ ] Are Firestore composite indexes defined in `firestore.indexes.json`?
- [ ] Are `onSnapshot()` listeners properly unsubscribed when components unmount?
- [ ] Is `onAuthStateChanged` used for auth state — not synchronous `auth.currentUser`?
- [ ] Are all development operations targeting the Firebase Emulator Suite, not production?
