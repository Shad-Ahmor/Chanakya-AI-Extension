import * as crypto from 'crypto';
import * as vscode from 'vscode';

/**
 * Security helper utilities for Chanakya AI Agent to eliminate vulnerabilities (XSS, Injection, Secret Leaks).
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
    // Strictly enforce CSP without 'unsafe-inline' for scripts to comply with Rule 1.
    return [
      `default-src 'none'`,
      `img-src ${webview.cspSource} https: data:`,
      `script-src 'nonce-${nonce}'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `font-src ${webview.cspSource}`,
      `connect-src https: http:`
    ].join('; ');
  }
}
