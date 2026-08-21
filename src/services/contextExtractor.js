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
exports.ContextExtractor = void 0;
const vscode = __importStar(require("vscode"));
const tokenOptimizer_1 = require("../utils/tokenOptimizer");
/**
 * ContextExtractor safely extracts lightweight, token-budgeted context from the active editor.
 */
class ContextExtractor {
    static MAX_SURROUNDING_LINES = 25;
    /**
     * Extracts active editor context with intelligent token/character budgeting.
     */
    static getActiveEditorContext() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return null;
        }
        const document = editor.document;
        const selection = editor.selection;
        let selectedText = document.getText(selection);
        let surroundingContext = '';
        if (!selection.isEmpty) {
            const startLine = Math.max(0, selection.start.line - this.MAX_SURROUNDING_LINES);
            const endLine = Math.min(document.lineCount - 1, selection.end.line + this.MAX_SURROUNDING_LINES);
            const beforeRange = new vscode.Range(startLine, 0, selection.start.line, 0);
            const afterRange = new vscode.Range(selection.end.line + 1, 0, endLine, document.lineAt(endLine).text.length);
            const beforeText = document.getText(beforeRange);
            const afterText = document.getText(afterRange);
            surroundingContext = `// --- Surrounding Context (Lines ${startLine + 1} to ${endLine + 1}) ---\n${beforeText}\n/* [SELECTED CODE BLOCK] */\n${afterText}`;
            // Minify surrounding context to aggressively save tokens
            surroundingContext = tokenOptimizer_1.TokenOptimizer.minifyCode(surroundingContext, document.languageId);
        }
        // Minify selected code
        selectedText = tokenOptimizer_1.TokenOptimizer.minifyCode(selectedText, document.languageId);
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
    static buildOptimizedPrompt(params) {
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
exports.ContextExtractor = ContextExtractor;
//# sourceMappingURL=contextExtractor.js.map