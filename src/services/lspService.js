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
exports.LspService = void 0;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
class LspService {
    static instance;
    logger = logger_1.Logger.getInstance();
    static getInstance() {
        if (!LspService.instance) {
            LspService.instance = new LspService();
        }
        return LspService.instance;
    }
    /**
     * Find definition of symbol at file position (goToDefinition)
     */
    async goToDefinition(filePath, line, character) {
        try {
            const uri = this.resolveUri(filePath);
            const position = new vscode.Position(line, character);
            const definitions = await vscode.commands.executeCommand('vscode.executeDefinitionProvider', uri, position);
            if (!definitions || definitions.length === 0) {
                return [];
            }
            const results = [];
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
                }
                else {
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
        }
        catch (err) {
            this.logger.error(`[LspService] goToDefinition failed on ${filePath}:${line}:${character}`, err);
            return [];
        }
    }
    /**
     * Find interface implementations at file position (goToImplementation)
     */
    async goToImplementation(filePath, line, character) {
        try {
            const uri = this.resolveUri(filePath);
            const position = new vscode.Position(line, character);
            const implementations = await vscode.commands.executeCommand('vscode.executeImplementationProvider', uri, position);
            if (!implementations || implementations.length === 0) {
                return [];
            }
            const results = [];
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
                }
                else {
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
        }
        catch (err) {
            this.logger.error(`[LspService] goToImplementation failed on ${filePath}:${line}:${character}`, err);
            return [];
        }
    }
    /**
     * Find all references of symbol across workspace (findReferences)
     */
    async findReferences(filePath, line, character) {
        try {
            const uri = this.resolveUri(filePath);
            const position = new vscode.Position(line, character);
            const locations = await vscode.commands.executeCommand('vscode.executeReferenceProvider', uri, position);
            if (!locations || locations.length === 0) {
                return [];
            }
            const results = [];
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
        }
        catch (err) {
            this.logger.error(`[LspService] findReferences failed on ${filePath}:${line}:${character}`, err);
            return [];
        }
    }
    /**
     * Get hover tooltip / type signature / docstring at position (hover)
     */
    async hover(filePath, line, character) {
        try {
            const uri = this.resolveUri(filePath);
            const position = new vscode.Position(line, character);
            const hovers = await vscode.commands.executeCommand('vscode.executeHoverProvider', uri, position);
            if (!hovers || hovers.length === 0) {
                return null;
            }
            const contents = [];
            for (const h of hovers) {
                for (const item of h.contents) {
                    if (typeof item === 'string') {
                        contents.push(item);
                    }
                    else if ('value' in item) {
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
        }
        catch (err) {
            this.logger.error(`[LspService] hover failed on ${filePath}:${line}:${character}`, err);
            return null;
        }
    }
    resolveUri(filePath) {
        if (vscode.Uri.parse(filePath).scheme === 'file') {
            return vscode.Uri.file(filePath);
        }
        const wsFolders = vscode.workspace.workspaceFolders;
        if (wsFolders && wsFolders.length > 0) {
            return vscode.Uri.joinPath(wsFolders[0].uri, filePath);
        }
        return vscode.Uri.file(filePath);
    }
    async getSnippet(uri, line) {
        try {
            const doc = await vscode.workspace.openTextDocument(uri);
            const lineObj = doc.lineAt(Math.min(line, doc.lineCount - 1));
            return lineObj.text.trim();
        }
        catch {
            return '';
        }
    }
}
exports.LspService = LspService;
//# sourceMappingURL=lspService.js.map