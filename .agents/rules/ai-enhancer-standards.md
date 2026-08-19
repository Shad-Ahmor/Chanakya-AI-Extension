---
description: Golden standards for Chanakya AI Enhancer VS Code Extension (Security, Token Optimization, Native UI, TypeScript)
trigger: always_on
---

# Chanakya AI Enhancer Development Guidelines

Adhere to the following rules for all development on the Chanakya AI Enhancer VS Code Extension:

1. **Security & Zero Vulnerability**:
   - Store all API keys exclusively in `vscode.ExtensionContext.secrets` (`SecretStorage`). Never write secrets to plaintext configs.
   - All Webviews MUST include strict Content-Security-Policy (CSP) with a unique cryptographic `nonce` on every render.
   - Escape all untrusted user and LLM content using `SecurityUtils.escapeHtml`.
   - Never use `eval()` or unvalidated `child_process.exec()`.

2. **Token Efficiency & LLM Handling**:
   - Limit prompt context strictly to relevant ranges (max 25 surrounding lines or targeted AST nodes).
   - Character/token budget caps must be enforced on selections before transmission.
   - Use streaming generation and support `vscode.CancellationToken` aborting.

3. **VS Code Design & UI**:
   - Use VS Code theme variables (`var(--vscode-...)`) exclusively for all colors, inputs, and buttons.
   - Maintain a full-screen immersive WebviewPanel (Dashboard) layout for the UI rather than a narrow sidebar.
   - Ensure the UI remains native, fast, and uses glassmorphism/micro-interactions where appropriate.
4. **Code Quality & Architecture**:
   - Strict TypeScript (`strict: true`, no `any`).
   - Clean separation of concerns (`services`, `providers`, `commands`, `utils`).
   - All disposables must be registered to `context.subscriptions`.

5. **Build & Packaging**:
   - BEFORE running `npx vsce package`, ALWAYS delete any existing `.vsix` file first:
     ```
     rm -f /Users/shadahmor/Documents/Projects/VS_Extension/AI\ Enhancer/chanakya-ai-enhancer-*.vsix
     ```
   - Only then run `npx vsce package` to produce a clean, fresh `.vsix`.
   - Never leave stale `.vsix` files in the workspace root.
