"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolSpillService = void 0;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
class ToolSpillService {
    static instance;
    logger = logger_1.Logger.getInstance();
    // Threshold: outputs larger than 12,000 characters (~3000 tokens) get spilled to disk
    MAX_INLINE_CHARS = 12000;
    static getInstance() {
        if (!ToolSpillService.instance) {
            ToolSpillService.instance = new ToolSpillService();
        }
        return ToolSpillService.instance;
    }
    /**
     * Evaluates if content is too large. If so, saves full output to a spill file and returns a structured summary.
     */
    async handleOutputSpill(toolName, rawContent) {
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
        }
        catch (err) {
            this.logger.error(`[ToolSpillService] Failed to spill output for ${toolName}`, err);
            return {
                isSpilled: true,
                content: `${rawContent.slice(0, this.MAX_INLINE_CHARS)}\n\n...[OUTPUT COMPACTED: ${originalSize - this.MAX_INLINE_CHARS} characters truncated]...`,
                originalSizeBytes: originalSize
            };
        }
    }
}
exports.ToolSpillService = ToolSpillService;
//# sourceMappingURL=toolSpillService.js.map