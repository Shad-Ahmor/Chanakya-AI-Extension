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
exports.ContextProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const logger_1 = require("../utils/logger");
/**
 * ContextProvider handles intelligent cross-platform IDE context extraction:
 * - @file: specific file content with token budgeting
 * - @active: current active open document
 * - @problems: current workspace linter & diagnostic errors
 */
class ContextProvider {
    static instance;
    logger = logger_1.Logger.getInstance();
    static getInstance() {
        if (!ContextProvider.instance) {
            ContextProvider.instance = new ContextProvider();
        }
        return ContextProvider.instance;
    }
    /**
     * Reads a workspace file by path (cross-platform Windows & macOS/Linux).
     */
    async getFileContext(filePath) {
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
        }
        catch (err) {
            this.logger.error(`Failed to read file for context: ${filePath}`, err);
            return null;
        }
    }
    /**
     * Gets context of currently active editor file.
     */
    getActiveEditorContext() {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return null;
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
    getWorkspaceProblemsContext() {
        const diagnostics = vscode.languages.getDiagnostics();
        const problemLines = [];
        for (const [uri, diags] of diagnostics) {
            if (diags.length === 0)
                continue;
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
exports.ContextProvider = ContextProvider;
//# sourceMappingURL=contextProvider.js.map