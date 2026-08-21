import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

export interface SpillResult {
  isSpilled: boolean;
  content: string;
  spillPath?: string | undefined;
  originalSizeBytes?: number | undefined;
}

export class ToolSpillService {
  private static instance: ToolSpillService;
  private readonly logger = Logger.getInstance();

  // Threshold: outputs larger than 12,000 characters (~3000 tokens) get spilled to disk
  private readonly MAX_INLINE_CHARS = 12000;

  public static getInstance(): ToolSpillService {
    if (!ToolSpillService.instance) {
      ToolSpillService.instance = new ToolSpillService();
    }
    return ToolSpillService.instance;
  }

  /**
   * Evaluates if content is too large. If so, saves full output to a spill file and returns a structured summary.
   */
  public async handleOutputSpill(toolName: string, rawContent: string): Promise<SpillResult> {
    if (!rawContent || rawContent.length <= this.MAX_INLINE_CHARS) {
      return {
        isSpilled: false,
        content: rawContent
      };
    }

    const originalSize = rawContent.length;
    const wsFolders = vscode.workspace.workspaceFolders;
    if (!wsFolders || wsFolders.length === 0) {
      // Truncate safely with notice if no workspace
      return {
        isSpilled: true,
        content: `${rawContent.slice(0, this.MAX_INLINE_CHARS)}\n\n...[OUTPUT COMPACTED: ${originalSize - this.MAX_INLINE_CHARS} characters truncated to protect token budget]...`,
        originalSizeBytes: originalSize
      };
    }

    try {
      const spillDir = vscode.Uri.joinPath(wsFolders[0].uri, '.chanakya', 'spills');
      await vscode.workspace.fs.createDirectory(spillDir);

      const fileName = `spill_${toolName}_${Date.now()}.txt`;
      const spillFileUri = vscode.Uri.joinPath(spillDir, fileName);

      await vscode.workspace.fs.writeFile(spillFileUri, Buffer.from(rawContent, 'utf-8'));
      const relativeSpillPath = vscode.workspace.asRelativePath(spillFileUri);

      this.logger.log(`[ToolSpillService] Spilled ${originalSize} chars from tool '${toolName}' to ${relativeSpillPath}`);

      const previewStart = rawContent.slice(0, 4000);
      const previewEnd = rawContent.slice(-2000);

      const compactedSummary = `${previewStart}

... [OUTPUT SPILLED TO DISK: ${originalSize} total characters. Complete output saved to ${relativeSpillPath}] ...

${previewEnd}`;

      return {
        isSpilled: true,
        content: compactedSummary,
        spillPath: relativeSpillPath,
        originalSizeBytes: originalSize
      };
    } catch (err) {
      this.logger.error(`[ToolSpillService] Failed to spill output for ${toolName}`, err);
      return {
        isSpilled: true,
        content: `${rawContent.slice(0, this.MAX_INLINE_CHARS)}\n\n...[OUTPUT COMPACTED: ${originalSize - this.MAX_INLINE_CHARS} characters truncated]...`,
        originalSizeBytes: originalSize
      };
    }
  }
}
