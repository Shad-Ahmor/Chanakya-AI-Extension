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
exports.InlineCompletionProvider = void 0;
const vscode = __importStar(require("vscode"));
const fimService_1 = require("../services/fimService");
const logger_1 = require("../utils/logger");
/**
 * InlineCompletionProvider connects VS Code's editor typing events to the FIM LLM Engine.
 * Debounces requests by 300ms and renders ghost text inline.
 */
class InlineCompletionProvider {
    fimService = fimService_1.FIMService.getInstance();
    logger = logger_1.Logger.getInstance();
    debounceTimer;
    isEnabled = true;
    toggle(enabled) {
        this.isEnabled = enabled ?? !this.isEnabled;
        this.logger.log(`Inline Autocomplete toggled: ${this.isEnabled ? 'ENABLED' : 'DISABLED'}`);
        return this.isEnabled;
    }
    async provideInlineCompletionItems(document, position, _context, token) {
        if (!this.isEnabled) {
            return null;
        }
        // Check user setting
        const config = vscode.workspace.getConfiguration('aiEnhancer');
        if (!config.get('autocomplete.enabled', true)) {
            return null;
        }
        // Debounce typing (default 300ms)
        const debounceMs = config.get('autocomplete.debounceMs', 300);
        return new Promise((resolve) => {
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }
            this.debounceTimer = setTimeout(async () => {
                if (token.isCancellationRequested) {
                    resolve(null);
                    return;
                }
                try {
                    const docText = document.getText();
                    const offset = document.offsetAt(position);
                    // Extract prefix (up to 2500 chars backwards)
                    const prefixStart = Math.max(0, offset - 2500);
                    const prefix = docText.substring(prefixStart, offset);
                    // Extract suffix (up to 1200 chars forwards)
                    const suffixEnd = Math.min(docText.length, offset + 1200);
                    const suffix = docText.substring(offset, suffixEnd);
                    // Don't trigger if empty line with no context
                    if (prefix.trim().length === 0 && suffix.trim().length === 0) {
                        resolve(null);
                        return;
                    }
                    const completionText = await this.fimService.getFIMCompletion({
                        prefix,
                        suffix,
                        languageId: document.languageId,
                        token
                    });
                    if (!completionText || completionText.trim().length === 0) {
                        resolve(null);
                        return;
                    }
                    const range = new vscode.Range(position, position);
                    const item = new vscode.InlineCompletionItem(completionText, range);
                    resolve([item]);
                }
                catch (err) {
                    this.logger.error('Error providing inline completion items', err);
                    resolve(null);
                }
            }, debounceMs);
        });
    }
}
exports.InlineCompletionProvider = InlineCompletionProvider;
//# sourceMappingURL=inlineCompletionProvider.js.map