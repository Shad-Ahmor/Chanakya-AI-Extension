import * as crypto from 'crypto';
import * as vscode from 'vscode';

/**
 * Security helper utilities for Chanakya AI Enhancer to eliminate vulnerabilities (XSS, Injection, Secret Leaks).
 */
export class SecurityUtils {
  /**
   * Generates a cryptographically random 32-character base64 nonce.
   */
  public static generateNonce(): string {
    return crypto.randomBytes(16).toString('base64');
  }

  /**
   * Escapes untrusted text to prevent XSS attacks in HTML contexts.
   */
  public static escapeHtml(unsafeText: string): string {
    return unsafeText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Generates strict Content Security Policy (CSP) for Webviews.
   */
  public static getWebviewCsp(webview: vscode.Webview, nonce: string): string {
    // NOTE: 'unsafe-inline' is required for script-src because vite-plugin-singlefile
    // bundles the entire React app as inline <script> blocks. Nonce alone is insufficient
    // for inline-bundled apps in VS Code webviews.
    return [
      `default-src 'none'`,
      `img-src ${webview.cspSource} https: data:`,
      `script-src 'nonce-${nonce}' 'unsafe-inline'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `font-src ${webview.cspSource}`,
      `connect-src https: http:`
    ].join('; ');
  }
}
