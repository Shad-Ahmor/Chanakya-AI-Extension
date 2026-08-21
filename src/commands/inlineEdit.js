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
exports.InlineEditCommand = void 0;
const vscode = __importStar(require("vscode"));
const llmGateway_1 = require("../services/llmGateway");
const inlineEditProvider_1 = require("../providers/inlineEditProvider");
class InlineEditCommand {
    _provider;
    // Keep track of the active edit session so we can apply it later
    activeSession;
    constructor(provider) {
        this._provider = provider;
    }
    async handleInlineEdit() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No active editor found.');
            return;
        }
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('Please select some code to edit first.');
            return;
        }
        const selectedText = editor.document.getText(selection);
        // Prompt user for instructions
        const instruction = await vscode.window.showInputBox({
            placeHolder: 'e.g., Refactor to use async/await, add comments, fix bugs...',
            prompt: 'Chanakya AI: What do you want to do with this code?'
        });
        if (!instruction) {
            return; // User cancelled
        }
        // Prepare system prompt for strict code-only output
        const prompt = `You are an expert AI coding assistant. You must modify the provided code according to the instruction.
IMPORTANT RULES:
1. ONLY output the modified code.
2. DO NOT wrap the code in markdown blocks (e.g. \`\`\`javascript). Just output raw text.
3. DO NOT output any conversational text or explanations.
4. Output the full replacement for the selected code, maintaining exact indentation if possible.

Instruction: ${instruction}

Code to modify:
${selectedText}`;
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Chanakya AI is rewriting your code...',
            cancellable: true
        }, async (_progress, token) => {
            try {
                const llmGateway = llmGateway_1.LLMGateway.getInstance();
                let resultText = '';
                await llmGateway.streamChat({
                    prompt,
                    contextItems: [],
                    cancellationToken: token,
                    callbacks: {
                        onChunk: (chunk) => {
                            resultText += chunk;
                        },
                        onComplete: async (fullText) => {
                            resultText = fullText;
                        },
                        onError: (error) => {
                            throw error;
                        }
                    }
                });
                // Clean up any markdown blocks if the LLM disobeyed
                resultText = resultText.replace(/^```[a-z]*\n/gi, '').replace(/\n```$/g, '');
                // Setup virtual URIs for Diff
                const timestamp = Date.now();
                const fileName = editor.document.fileName.split('/').pop() || 'code';
                const originalUri = vscode.Uri.parse(`${inlineEditProvider_1.InlineEditProvider.scheme}:original-${timestamp}-${fileName}`);
                const modifiedUri = vscode.Uri.parse(`${inlineEditProvider_1.InlineEditProvider.scheme}:modified-${timestamp}-${fileName}`);
                // Update virtual documents
                this._provider.updateDocument(originalUri, selectedText);
                this._provider.updateDocument(modifiedUri, resultText);
                // Store session state
                this.activeSession = {
                    originalUri,
                    modifiedUri,
                    targetEditor: editor,
                    targetRange: selection,
                    modifiedText: resultText
                };
                // Open Diff Editor
                await vscode.commands.executeCommand('vscode.diff', originalUri, modifiedUri, `Chanakya Inline Edit (Cmd+Shift+Enter to Accept)`);
            }
            catch (error) {
                vscode.window.showErrorMessage(`Chanakya AI Error: ${error.message}`);
            }
        });
    }
    async handleAcceptEdit() {
        if (!this.activeSession) {
            vscode.window.showWarningMessage('No active Chanakya edit session to accept.');
            return;
        }
        const { targetEditor, targetRange, modifiedText } = this.activeSession;
        // We must ensure the original document is still open
        try {
            // Execute edit on the original editor
            await targetEditor.edit(builder => {
                builder.replace(targetRange, modifiedText);
            });
            // Close the diff editor (which is the active one when they press accept)
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
            vscode.window.showInformationMessage('Chanakya AI: Edit Applied!');
            // Clear session
            this.activeSession = undefined;
        }
        catch (err) {
            vscode.window.showErrorMessage(`Failed to apply edit: ${err.message}`);
        }
    }
}
exports.InlineEditCommand = InlineEditCommand;
//# sourceMappingURL=inlineEdit.js.map