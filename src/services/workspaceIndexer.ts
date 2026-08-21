import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
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

  /**
   * Scans the workspace and generates an architecture.md index.
   */
  public async generateArchitectureMap(): Promise<string> {
    const ws = vscode.workspace.workspaceFolders;
    if (!ws || ws.length === 0) throw new Error('No workspace open');
    
    const rootPath = ws[0].uri.fsPath;
    this.logger.log('[WorkspaceIndexer] Generating Architecture Map...');
    
    const uris = await vscode.workspace.findFiles('**/*', '{**/node_modules/**,**/dist/**,**/.git/**,**/.vscode/**,**/build/**,out/**}');
    let architecture = '# Workspace Architecture\\n\\nThis document outlines the high-level structure and components of the codebase.\\n\\n';
    
    // Group files by directory
    const structure: Record<string, string[]> = {};
    for (const uri of uris) {
      const relPath = vscode.workspace.asRelativePath(uri);
      const dir = path.dirname(relPath);
      const file = path.basename(relPath);
      
      if (!structure[dir]) structure[dir] = [];
      structure[dir].push(file);
    }
    
    for (const dir of Object.keys(structure).sort()) {
      architecture += `## ${dir === '.' ? 'Root' : dir}\\n`;
      for (const file of structure[dir].sort()) {
        architecture += `- \`${file}\``;
        
        // Optional: Extract basic symbols if it's a code file
        if (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.py')) {
          try {
            const content = await fs.readFile(path.join(rootPath, dir, file), 'utf8');
            const lines = content.split('\\n');
            const symbols = [];
            for (const line of lines) {
              const exportMatch = line.match(/export (class|interface|function|const) ([a-zA-Z0-9_]+)/);
              if (exportMatch) symbols.push(exportMatch[2]);
              
              const defMatch = line.match(/def ([a-zA-Z0-9_]+)/); // python
              if (defMatch) symbols.push(defMatch[1]);
              
              const classMatch = line.match(/class ([a-zA-Z0-9_]+)/); // python
              if (classMatch && !exportMatch) symbols.push(classMatch[1]);
            }
            if (symbols.length > 0) {
              architecture += ` (Exports/Symbols: ${symbols.slice(0, 5).join(', ')}${symbols.length > 5 ? '...' : ''})`;
            }
          } catch (e) {
            // ignore
          }
        }
        architecture += '\\n';
      }
      architecture += '\\n';
    }
    
    const chanakyaDir = path.join(rootPath, '.chanakya');
    await fs.mkdir(chanakyaDir, { recursive: true });
    
    const outPath = path.join(chanakyaDir, 'architecture.md');
    await fs.writeFile(outPath, architecture, 'utf8');
    
    this.logger.log(`[WorkspaceIndexer] Saved architecture to ${outPath}`);
    return outPath;
  }
}
