import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

export interface LspLocationResult {
  filePath: string;
  line: number;
  character: number;
  previewSnippet?: string | undefined;
}

export interface LspHoverResult {
  contents: string[];
  range?: {
    startLine: number;
    startChar: number;
    endLine: number;
    endChar: number;
  } | undefined;
}

export class LspService {
  private static instance: LspService;
  private readonly logger = Logger.getInstance();

  public static getInstance(): LspService {
    if (!LspService.instance) {
      LspService.instance = new LspService();
    }
    return LspService.instance;
  }

  /**
   * Find definition of symbol at file position (goToDefinition)
   */
  public async goToDefinition(filePath: string, line: number, character: number): Promise<LspLocationResult[]> {
    try {
      const uri = this.resolveUri(filePath);
      const position = new vscode.Position(line, character);

      const definitions = await vscode.commands.executeCommand<vscode.Location[] | vscode.LocationLink[]>(
        'vscode.executeDefinitionProvider',
        uri,
        position
      );

      if (!definitions || definitions.length === 0) {
        return [];
      }

      const results: LspLocationResult[] = [];
      for (const def of definitions) {
        if ('targetUri' in def) {
          // LocationLink
          const targetUri = def.targetUri;
          const range = def.targetRange;
          results.push({
            filePath: vscode.workspace.asRelativePath(targetUri),
            line: range.start.line,
            character: range.start.character,
            previewSnippet: await this.getSnippet(targetUri, range.start.line)
          });
        } else {
          // Location
          results.push({
            filePath: vscode.workspace.asRelativePath(def.uri),
            line: def.range.start.line,
            character: def.range.start.character,
            previewSnippet: await this.getSnippet(def.uri, def.range.start.line)
          });
        }
      }

      this.logger.log(`[LspService] goToDefinition resolved ${results.length} targets`);
      return results;
    } catch (err) {
      this.logger.error(`[LspService] goToDefinition failed on ${filePath}:${line}:${character}`, err);
      return [];
    }
  }

  /**
   * Find interface implementations at file position (goToImplementation)
   */
  public async goToImplementation(filePath: string, line: number, character: number): Promise<LspLocationResult[]> {
    try {
      const uri = this.resolveUri(filePath);
      const position = new vscode.Position(line, character);

      const implementations = await vscode.commands.executeCommand<vscode.Location[] | vscode.LocationLink[]>(
        'vscode.executeImplementationProvider',
        uri,
        position
      );

      if (!implementations || implementations.length === 0) {
        return [];
      }

      const results: LspLocationResult[] = [];
      for (const impl of implementations) {
        if ('targetUri' in impl) {
          const targetUri = impl.targetUri;
          const range = impl.targetRange;
          results.push({
            filePath: vscode.workspace.asRelativePath(targetUri),
            line: range.start.line,
            character: range.start.character,
            previewSnippet: await this.getSnippet(targetUri, range.start.line)
          });
        } else {
          results.push({
            filePath: vscode.workspace.asRelativePath(impl.uri),
            line: impl.range.start.line,
            character: impl.range.start.character,
            previewSnippet: await this.getSnippet(impl.uri, impl.range.start.line)
          });
        }
      }

      this.logger.log(`[LspService] goToImplementation resolved ${results.length} targets`);
      return results;
    } catch (err) {
      this.logger.error(`[LspService] goToImplementation failed on ${filePath}:${line}:${character}`, err);
      return [];
    }
  }

  /**
   * Find all references of symbol across workspace (findReferences)
   */
  public async findReferences(filePath: string, line: number, character: number): Promise<LspLocationResult[]> {
    try {
      const uri = this.resolveUri(filePath);
      const position = new vscode.Position(line, character);

      const locations = await vscode.commands.executeCommand<vscode.Location[]>(
        'vscode.executeReferenceProvider',
        uri,
        position
      );

      if (!locations || locations.length === 0) {
        return [];
      }

      const results: LspLocationResult[] = [];
      for (const loc of locations.slice(0, 30)) {
        results.push({
          filePath: vscode.workspace.asRelativePath(loc.uri),
          line: loc.range.start.line,
          character: loc.range.start.character,
          previewSnippet: await this.getSnippet(loc.uri, loc.range.start.line)
        });
      }

      this.logger.log(`[LspService] findReferences resolved ${results.length} occurrences`);
      return results;
    } catch (err) {
      this.logger.error(`[LspService] findReferences failed on ${filePath}:${line}:${character}`, err);
      return [];
    }
  }

  /**
   * Get hover tooltip / type signature / docstring at position (hover)
   */
  public async hover(filePath: string, line: number, character: number): Promise<LspHoverResult | null> {
    try {
      const uri = this.resolveUri(filePath);
      const position = new vscode.Position(line, character);

      const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
        'vscode.executeHoverProvider',
        uri,
        position
      );

      if (!hovers || hovers.length === 0) {
        return null;
      }

      const contents: string[] = [];
      for (const h of hovers) {
        for (const item of h.contents) {
          if (typeof item === 'string') {
            contents.push(item);
          } else if ('value' in item) {
            contents.push(item.value);
          }
        }
      }

      const firstHover = hovers[0];
      return {
        contents,
        range: firstHover.range ? {
          startLine: firstHover.range.start.line,
          startChar: firstHover.range.start.character,
          endLine: firstHover.range.end.line,
          endChar: firstHover.range.end.character
        } : undefined
      };
    } catch (err) {
      this.logger.error(`[LspService] hover failed on ${filePath}:${line}:${character}`, err);
      return null;
    }
  }

  private resolveUri(filePath: string): vscode.Uri {
    if (vscode.Uri.parse(filePath).scheme === 'file') {
      return vscode.Uri.file(filePath);
    }
    const wsFolders = vscode.workspace.workspaceFolders;
    if (wsFolders && wsFolders.length > 0) {
      return vscode.Uri.joinPath(wsFolders[0].uri, filePath);
    }
    return vscode.Uri.file(filePath);
  }

  private async getSnippet(uri: vscode.Uri, line: number): Promise<string> {
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      const lineObj = doc.lineAt(Math.min(line, doc.lineCount - 1));
      return lineObj.text.trim();
    } catch {
      return '';
    }
  }
}
