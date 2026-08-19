import * as vscode from 'vscode';
import { CodeContext } from '../types';

/**
 * ContextExtractor safely extracts lightweight, token-budgeted context from the active editor.
 */
export class ContextExtractor {
  private static readonly MAX_SURROUNDING_LINES = 25;
  private static readonly MAX_SELECTION_LENGTH = 12000; // ~3000 tokens max to protect token quota

  /**
   * Extracts active editor context with intelligent token/character budgeting.
   */
  public static getActiveEditorContext(): CodeContext | null {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return null;
    }

    const document = editor.document;
    const selection = editor.selection;
    let selectedText = document.getText(selection);

    // If selection exceeds safe limit, truncate with notice
    if (selectedText.length > this.MAX_SELECTION_LENGTH) {
      selectedText =
        selectedText.substring(0, this.MAX_SELECTION_LENGTH) +
        '\n\n/* ... [Truncated by Chanakya AI Enhancer to conserve token quota] ... */';
    }

    let surroundingContext = '';
    if (!selection.isEmpty) {
      const startLine = Math.max(0, selection.start.line - this.MAX_SURROUNDING_LINES);
      const endLine = Math.min(document.lineCount - 1, selection.end.line + this.MAX_SURROUNDING_LINES);
      
      const beforeRange = new vscode.Range(startLine, 0, selection.start.line, 0);
      const afterRange = new vscode.Range(selection.end.line + 1, 0, endLine, document.lineAt(endLine).text.length);

      const beforeText = document.getText(beforeRange);
      const afterText = document.getText(afterRange);

      surroundingContext = `// --- Surrounding Context (Lines ${startLine + 1} to ${endLine + 1}) ---\n${beforeText}\n/* [SELECTED CODE BLOCK] */\n${afterText}`;
    }

    return {
      languageId: document.languageId,
      fileName: document.fileName.split('/').pop() || document.fileName,
      selectedCode: selectedText,
      surroundingContext: surroundingContext || undefined,
      cursorPosition: {
        line: selection.active.line + 1,
        character: selection.active.character + 1
      },
      totalLines: document.lineCount
    };
  }

  /**
   * Generates a concise, structured system prompt for the AI to minimize token usage while maximizing accuracy.
   */
  public static buildOptimizedPrompt(params: {
    instruction: string;
    context?: CodeContext | null | undefined;
    action?: string | undefined;
  }): string {
    const { instruction, context, action } = params;

    let prompt = '';
    if (action) {
      prompt += `[Task Action: ${action.toUpperCase()}]\n`;
    }

    if (context && context.selectedCode.trim().length > 0) {
      prompt += `[Target File: ${context.fileName} (${context.languageId})]\n`;
      prompt += `\`\`\`${context.languageId}\n${context.selectedCode}\n\`\`\`\n\n`;
      if (context.surroundingContext) {
        prompt += `[Surrounding Context References]\n${context.surroundingContext}\n\n`;
      }
    }

    prompt += `[User Instruction]:\n${instruction}\n\n`;
    prompt += `[Constraint]: Provide production-ready, clean, secure code. Keep explanations concise, clear, and relevant. Avoid unnecessary conversational fluff to optimize tokens.`;

    return prompt;
  }
}
