# Chanakya AI Enhancer — Core Project Rules & Architectural Standards

These rules are strictly enforced across the entire Chanakya AI Enhancer codebase for every task, prompt, and iteration.

---

## 1. 🛡️ Security & Zero Vulnerability (CVE Prevention)
- **Zero Plaintext Secrets**: NEVER store API keys, tokens, or credentials in `settings.json`, workspace files, or `globalState`. ALWAYS use `vscode.ExtensionContext.secrets` (`SecretStorage`).
- **Strict Content Security Policy (CSP)**:
  - Every Webview must enforce a cryptographically secure `nonce` per render.
  - CSP must restrict: `default-src 'none'`, `script-src 'nonce-${nonce}'`, `style-src ${webview.cspSource} 'unsafe-inline'`, `font-src ${webview.cspSource}`, `img-src ${webview.cspSource} https: data:`.
  - Disallow any external arbitrary inline scripts (`unsafe-eval` is prohibited).
- **Safe IPC Messaging**: Validate and sanitize all messages received from `webview.onDidReceiveMessage` using strict type discrimination or schema validators.
- **No Unsafe Execution**: Never use `eval()`, `new Function()`, or unescaped shell commands (`child_process.exec` without parameter sanitization).
- **Safe HTML Rendering**: Always escape user inputs and LLM outputs with `SecurityUtils.escapeHtml` before rendering in webview HTML.

---

## 2. ⚡ Token Efficiency & Low-Cost LLM Budgeting
- **Smart Context Trimming**: Extract only the minimum necessary lines (max 25 lines before/after selection) rather than dumping entire files into the prompt.
- **Budgeting Limits**: Impose hard character/token caps on code snippets sent to LLMs (default limit ~3000 tokens) with explicit truncation warnings.
- **Streaming by Default**: All generation must be streamed via Server-Sent Events / streaming readers to minimize memory usage and provide instant feedback.
- **Cancellation Token Support**: Always pass `vscode.CancellationToken` / `AbortController` to abort ongoing LLM requests when a user edits code, switches context, or cancels.

---

## 3. 💎 UI / UX & VS Code Native Aesthetics
- **Theme Native**: Always use VS Code CSS variables (`var(--vscode-editor-background)`, `var(--vscode-input-background)`, `var(--vscode-button-background)`, etc.) so that all light, dark, and high-contrast themes look flawless.
- **Full-Screen Immersive Layout**: Maintain a full-screen Dashboard WebviewPanel layout rather than a narrow sidebar, utilizing glassmorphism and modern aesthetics.
- **Micro-animations**: Smooth fade-ins, animated streaming cursor, responsive quick-action chips, and clear code block action headers (Copy & Insert).
- **Accessibility (a11y)**: Standard semantic HTML, accessible aria-labels on buttons and interactive components, keyboard navigation (Enter / Shift+Enter handling).

---

## 4. 🏗️ Coding Standards & TypeScript Discipline
- **Strict TypeScript**: `strict: true`, no `any` types, explicit return types for public methods.
- **Disposable Lifecycle**: Every registered command, provider, status bar item, or event listener MUST be pushed into `context.subscriptions`.
- **Modular Architecture**:
  - `src/types/`: Strict type interfaces and IPC contracts.
  - `src/services/`: Independent services (SecretManager, AIService, ContextExtractor).
  - `src/providers/`: VS Code providers (Webview, CodeLens, Completions).
  - `src/commands/`: Command handlers and dispatchers.
  - `src/utils/`: Security, Logger, Helpers.
  - `media/`: Clean CSS and JS webview assets.
- **Error Boundaries**: Every async operation must have try-catch blocks logging to `Logger.getInstance().error()` without crashing the extension host.

---

## 5. 📦 Build & Packaging — Strict Clean Build Rule
- **ALWAYS delete the old `.vsix` before packaging a new one.** Run this command first, every single time:
  ```bash
  rm -f /Users/shadahmor/Documents/Projects/VS_Extension/AI\ Enhancer/chanakya-ai-enhancer-*.vsix
  ```
- Only AFTER deleting the old file, run `npx vsce package` to generate a fresh `.vsix`.
- Combined clean-build command to always use:
  ```bash
  rm -f chanakya-ai-enhancer-*.vsix && npm run build:webview && npx vsce package
  ```
- **Never leave stale `.vsix` files** in the workspace root — this prevents accidental re-installation of old builds.

---

## 6. 🚀 How to Reference This Rule in Future Prompts
Whenever you provide a prompt or ask for new features, simply mention:
> **"Follow Chanakya AI Enhancer Rules"** or **"@Rule:AI_ENHANCER"**

The assistant will automatically verify and adhere to all 6 principles above without needing repetitive instructions.
