import { Logger } from './logger';

export class SecurityGuardrails {
  private static readonly logger = Logger.getInstance();

  /**
   * Pre-flight Guardrail: Redacts sensitive information like API keys, secrets, 
   * and PII from the user prompt before sending it to the LLM.
   */
  public static redactSensitiveInfo(prompt: string): string {
    let sanitized = prompt;

    // Redact common API key patterns (OpenAI, GitHub, AWS, etc.)
    const keyPatterns = [
      /sk-[A-Za-z0-9]{48}/g,                 // OpenAI keys
      /ghp_[A-Za-z0-9]{36}/g,                // GitHub Personal Access Tokens
      /AKIA[0-9A-Z]{16}/g,                   // AWS Access Key ID
      /AIza[0-9A-Za-z-_]{35}/g,              // GCP API Key
      /xoxb-[0-9]{11}-[0-9]{11}-[a-zA-Z0-9]{24}/g // Slack Bot Token
    ];

    keyPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED_API_KEY]');
    });

    // Redact PII (Basic examples: Emails, Phone Numbers)
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    sanitized = sanitized.replace(emailPattern, '[REDACTED_EMAIL]');

    const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/g;
    sanitized = sanitized.replace(ssnPattern, '[REDACTED_SSN]');

    if (sanitized !== prompt) {
      this.logger.warn('SecurityGuardrails: Sensitive information redacted from the prompt.');
    }

    return sanitized;
  }

  /**
   * Post-flight Guardrail: Analyzes the LLM output for potentially malicious 
   * code execution patterns (like `eval`, `child_process.exec`) and returns a warning.
   */
  public static validateGeneratedCode(output: string): { isValid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    
    // Look for unsafe dynamic execution
    if (/eval\s*\(/.test(output)) {
      warnings.push('CRITICAL: Detected `eval()` in generated code. This can lead to remote code execution vulnerabilities.');
    }

    // Look for unvalidated OS commands
    if (/child_process\.(exec|spawn|execSync)\s*\(/.test(output)) {
      warnings.push('WARNING: Detected OS command execution. Ensure all inputs are properly sanitized to prevent command injection.');
    }

    // Look for unsafe HTML rendering
    if (/dangerouslySetInnerHTML/.test(output) || /innerHTML\s*=/.test(output)) {
      warnings.push('WARNING: Detected potential XSS vulnerability (dangerouslySetInnerHTML / innerHTML).');
    }

    // Dangerous DB queries
    if (/SELECT\s+\*\s+FROM\s+.*WHERE.*=\s*\+/.test(output) || /execute\s*\(\s*`.*`\s*\)/.test(output)) {
      warnings.push('WARNING: Detected potential SQL Injection pattern. Always use parameterized queries.');
    }

    if (warnings.length > 0) {
      this.logger.warn(`SecurityGuardrails: Post-flight validation failed with ${warnings.length} warnings.`);
    }

    return {
      isValid: warnings.length === 0,
      warnings
    };
  }
}
