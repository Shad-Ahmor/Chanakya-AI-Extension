import * as vscode from 'vscode';
import * as path from 'path';
import { ContextItem } from '../types/ipc';
import { Logger } from '../utils/logger';

/**
 * ContextProvider handles intelligent cross-platform IDE context extraction:
 * - @file: specific file content with token budgeting
 * - @active: current active open document
 * - @problems: current workspace linter & diagnostic errors
 */
export class ContextProvider {
  private static instance: ContextProvider;
  private readonly logger = Logger.getInstance();

  public static getInstance(): ContextProvider {
    if (!ContextProvider.instance) {
      ContextProvider.instance = new ContextProvider();
    }
    return ContextProvider.instance;
  }

  /**
   * Reads a workspace file by path (cross-platform Windows & macOS/Linux).
   */
  public async getFileContext(filePath: string): Promise<ContextItem | null> {
    try {
      const doc = await vscode.workspace.openTextDocument(filePath);
      let content = doc.getText().replace(/\r\n/g, '\n');
      const fileName = path.basename(filePath);

      return {
        id: `file-${Date.now()}`,
        type: 'file',
        name: fileName,
        path: filePath,
        content
      };
    } catch (err) {
      this.logger.error(`Failed to read file for context: ${filePath}`, err);
      return null;
    }
  }

  /**
   * Gets context of currently active editor file.
   */
  public getActiveEditorContext(): ContextItem | null {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return null;

    const doc = editor.document;
    const fileName = path.basename(doc.fileName);
    let content = doc.getText().replace(/\r\n/g, '\n');

    return {
      id: `active-${Date.now()}`,
      type: 'file',
      name: `${fileName} (Active File)`,
      path: doc.fileName,
      content
    };
  }

  /**
   * Extracts active workspace diagnostics/errors (@problems).
   */
  public getWorkspaceProblemsContext(): ContextItem | null {
    const diagnostics = vscode.languages.getDiagnostics();
    const problemLines: string[] = [];

    for (const [uri, diags] of diagnostics) {
      if (diags.length === 0) continue;
      const fileName = path.basename(uri.fsPath);
      
      for (const d of diags) {
        if (d.severity === vscode.DiagnosticSeverity.Error || d.severity === vscode.DiagnosticSeverity.Warning) {
          const sev = d.severity === vscode.DiagnosticSeverity.Error ? 'ERROR' : 'WARN';
          problemLines.push(`[${sev}] ${fileName}:${d.range.start.line + 1}:${d.range.start.character + 1} - ${d.message}`);
        }
      }
    }

    if (problemLines.length === 0) {
      return {
        id: `problems-${Date.now()}`,
        type: 'file',
        name: 'Workspace Problems',
        content: 'No errors or warnings found in workspace.'
      };
    }

    return {
      id: `problems-${Date.now()}`,
      type: 'file',
      name: `Workspace Problems (${problemLines.length})`,
      content: problemLines.slice(0, 50).join('\n')
    };
  }
}
