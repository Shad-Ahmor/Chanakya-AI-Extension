import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { TokenOptimizer } from '../utils/tokenOptimizer';

export class WorkspaceIndexer {
  private static instance: WorkspaceIndexer;
  private readonly logger = Logger.getInstance();

  private constructor() {}

  public static getInstance(): WorkspaceIndexer {
    if (!WorkspaceIndexer.instance) {
      WorkspaceIndexer.instance = new WorkspaceIndexer();
    }
    return WorkspaceIndexer.instance;
  }

  /**
   * Searches the workspace for a file matching the filename query.
   * If found, returns the minified contents of the file to save tokens.
   */
  public async getFileContext(fileNameQuery: string): Promise<{ fileName: string; content: string } | null> {
    try {
      // Remove @ symbol if present
      const query = fileNameQuery.replace(/^@/, '').trim();
      if (!query) return null;

      this.logger.log(`[WorkspaceIndexer] Searching for file matching: ${query}`);

      // We'll search for the file using VS Code's native findFiles.
      // This supports partial matches e.g. "logger.ts" matches "src/utils/logger.ts"
      const uris = await vscode.workspace.findFiles(`**/*${query}*`, '**/node_modules/**,**/dist/**,**/.git/**', 5);

      if (uris.length === 0) {
        this.logger.log(`[WorkspaceIndexer] No files found for query: ${query}`);
        return null;
      }

      // We'll just take the best (first) match for simplicity in this Pro-Grade implementation
      const targetUri = uris[0];
      const document = await vscode.workspace.openTextDocument(targetUri);
      let rawText = document.getText();

      // Language Id extraction
      const langId = document.languageId;
      const fileName = targetUri.path.split('/').pop() || query;

      // Minify and truncate to prevent blowing up the context window
      const minifiedText = TokenOptimizer.minifyCode(rawText, langId);
      const safeText = TokenOptimizer.truncateText(minifiedText, 2500, false);

      this.logger.log(`[WorkspaceIndexer] Successfully extracted and minified ${fileName}`);
      
      return {
        fileName,
        content: `// --- File: ${fileName} ---\n${safeText}`
      };
    } catch (e) {
      this.logger.error(`[WorkspaceIndexer] Error fetching context for ${fileNameQuery}`, e);
      return null;
    }
  }
}
