import * as vscode from 'vscode';
import { FIMService } from '../services/fimService';
import { Logger } from '../utils/logger';

/**
 * InlineCompletionProvider connects VS Code's editor typing events to the FIM LLM Engine.
 * Debounces requests by 300ms and renders ghost text inline.
 */
export class InlineCompletionProvider implements vscode.InlineCompletionItemProvider {
  private readonly fimService = FIMService.getInstance();
  private readonly logger = Logger.getInstance();
  private debounceTimer?: NodeJS.Timeout | undefined;
  private isEnabled = true;

  public toggle(enabled?: boolean): boolean {
    this.isEnabled = enabled ?? !this.isEnabled;
    this.logger.log(`Inline Autocomplete toggled: ${this.isEnabled ? 'ENABLED' : 'DISABLED'}`);
    return this.isEnabled;
  }

  public async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | vscode.InlineCompletionList | null> {
    if (!this.isEnabled) {
      return null;
    }

    // Check user setting
    const config = vscode.workspace.getConfiguration('aiEnhancer');
    if (!config.get<boolean>('autocomplete.enabled', true)) {
      return null;
    }

    // Debounce typing (default 300ms)
    const debounceMs = config.get<number>('autocomplete.debounceMs', 300);

    return new Promise((resolve) => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(async () => {
        if (token.isCancellationRequested) {
          resolve(null);
          return;
        }

        try {
          const docText = document.getText();
          const offset = document.offsetAt(position);

          // Extract prefix (up to 2500 chars backwards)
          const prefixStart = Math.max(0, offset - 2500);
          const prefix = docText.substring(prefixStart, offset);

          // Extract suffix (up to 1200 chars forwards)
          const suffixEnd = Math.min(docText.length, offset + 1200);
          const suffix = docText.substring(offset, suffixEnd);

          // Don't trigger if empty line with no context
          if (prefix.trim().length === 0 && suffix.trim().length === 0) {
            resolve(null);
            return;
          }

          const completionText = await this.fimService.getFIMCompletion({
            prefix,
            suffix,
            languageId: document.languageId,
            token
          });

          if (!completionText || completionText.trim().length === 0) {
            resolve(null);
            return;
          }

          const range = new vscode.Range(position, position);
          const item = new vscode.InlineCompletionItem(completionText, range);
          resolve([item]);
        } catch (err) {
          this.logger.error('Error providing inline completion items', err);
          resolve(null);
        }
      }, debounceMs);
    });
  }
}
