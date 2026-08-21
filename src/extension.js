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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const inlineCompletionProvider_1 = require("./providers/inlineCompletionProvider");
const inlineEditProvider_1 = require("./providers/inlineEditProvider");
const sidebarProvider_1 = require("./providers/sidebarProvider");
const dashboardProvider_1 = require("./providers/dashboardProvider");
const configManager_1 = require("./services/configManager");
const mcpService_1 = require("./services/mcpService");
const logger_1 = require("./utils/logger");
const inlineEdit_1 = require("./commands/inlineEdit");
const VectorStore_1 = require("./services/memory/VectorStore");
const ConversationManager_1 = require("./services/ConversationManager");
const evaluationService_1 = require("./services/evaluationService");
const workspaceIndexer_1 = require("./services/workspaceIndexer");
const graphifyService_1 = require("./services/graphifyService");
/**
 * Chanakya AI Enhancer Extension Activation Entrypoint (Phases 1-5 Complete)
 */
async function activate(context) {
    const logger = logger_1.Logger.getInstance();
    logger.log('Activating Chanakya AI Enhancer (Full Continue/Copilot Engine with FIM Autocomplete)...');
    // 1. Initialize Configuration Manager
    const configManager = configManager_1.ConfigManager.getInstance();
    // Initialize Conversation Manager
    ConversationManager_1.ConversationManager.initialize(context);
    // Initialize EvaluationService
    evaluationService_1.EvaluationService.getInstance().initialize(context);
    // 1.5 Initialize MCP Client & Auto-Discovery
    const mcpService = mcpService_1.McpService.getInstance();
    const wsFolders = vscode.workspace.workspaceFolders;
    if (wsFolders && wsFolders.length > 0) {
        mcpService.loadConfig(wsFolders[0].uri.fsPath);
    }
    // 1.8 Initialize Vector Database for Memory RAG
    const vectorStore = VectorStore_1.VectorStore.getInstance();
    vectorStore.initialize(context.globalStorageUri);
    // 1.9 Register Graphify Incremental Watcher
    graphifyService_1.GraphifyService.getInstance().registerIncrementalWatcher(context);
    // 2. Register Sidebar Provider (Replaces Full Screen Dashboard)
    const sidebarProvider = new sidebarProvider_1.SidebarProvider(context.extensionUri, context);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(sidebarProvider_1.SidebarProvider.viewType, sidebarProvider, {
        webviewOptions: { retainContextWhenHidden: true }
    }));
    // 2.5 Phase 2: Inline Edit (Cmd+I)
    const inlineEditProvider = new inlineEditProvider_1.InlineEditProvider();
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(inlineEditProvider_1.InlineEditProvider.scheme, inlineEditProvider));
    const inlineEditCmd = new inlineEdit_1.InlineEditCommand(inlineEditProvider);
    context.subscriptions.push(vscode.commands.registerCommand('aiEnhancer.inlineEdit', async () => {
        await inlineEditCmd.handleInlineEdit();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('aiEnhancer.acceptEdit', async () => {
        await inlineEditCmd.handleAcceptEdit();
    }));
    // 3. Register Phase 5: Inline Autocomplete Provider (FIM)
    const inlineProvider = new inlineCompletionProvider_1.InlineCompletionProvider();
    context.subscriptions.push(vscode.languages.registerInlineCompletionItemProvider({ pattern: '**' }, inlineProvider));
    // 4. Register Command: Toggle Autocomplete
    context.subscriptions.push(vscode.commands.registerCommand('aiEnhancer.toggleAutocomplete', () => {
        const isEnabled = inlineProvider.toggle();
        vscode.window.showInformationMessage(`Chanakya AI Enhancer: Inline Autocomplete is now ${isEnabled ? 'ENABLED' : 'DISABLED'}`);
        updateStatusBar();
    }));
    // 5. Register Command: Add Active Selection to Context (Cmd+Alt+L / Ctrl+Alt+L)
    context.subscriptions.push(vscode.commands.registerCommand('aiEnhancer.addSelectionToContext', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showInformationMessage('Please select some code first to add it to Chanakya AI Enhancer.');
            return;
        }
        const document = editor.document;
        const selection = editor.selection;
        const selectedText = document.getText(selection).replace(/\r\n/g, '\n');
        const fileName = document.fileName.split(/[/\\]/).pop() || document.fileName;
        const startLine = selection.start.line + 1;
        const endLine = selection.end.line + 1;
        const contextItem = {
            id: `sel-${Date.now()}`,
            type: 'selection',
            name: `${fileName} (${startLine}-${endLine})`,
            content: selectedText,
            path: document.fileName,
            range: { startLine, endLine }
        };
        sidebarProvider.addContextItem(contextItem);
        logger.log(`Added selection context item: ${contextItem.name}`);
    }));
    // 7. Register Command: Open config.yaml
    context.subscriptions.push(vscode.commands.registerCommand('aiEnhancer.openConfigYaml', async () => {
        const filePath = configManager.getConfigFilePath();
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);
    }));
    // 8. Register Status Bar Items
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'workbench.view.extension.chanakya-ai-sidebar';
    function updateStatusBar() {
        const cfg = configManager.getConfig();
        const activeModel = cfg.models.find((m) => m.id === cfg.activeChatModelId);
        statusBarItem.text = `$(sparkle) AI: ${activeModel?.name || 'Enhancer'}`;
        statusBarItem.tooltip = `Chanakya AI Enhancer Connected (${activeModel?.model || 'Ready'}) - Click to Open`;
        statusBarItem.show();
    }
    updateStatusBar();
    context.subscriptions.push(statusBarItem);
    // 9. Register Dashboard Provider (Models Hub)
    const dashboardProvider = new dashboardProvider_1.DashboardProvider(context.extensionUri, context);
    context.subscriptions.push(vscode.commands.registerCommand('aiEnhancer.openModelsHub', (args) => {
        dashboardProvider.show(args);
    }), vscode.commands.registerCommand('aiEnhancer.openGraphify', () => {
        dashboardProvider.show({ tab: 'graphify' });
    }), vscode.commands.registerCommand('aiEnhancer.generateArchitecture', async () => {
        try {
            const outPath = await workspaceIndexer_1.WorkspaceIndexer.getInstance().generateArchitectureMap();
            vscode.window.showInformationMessage(`Workspace architecture generated at: ${outPath}`);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Failed to generate architecture: ${err.message}`);
        }
    }), vscode.commands.registerCommand('aiEnhancer.setupMcp', async () => {
        const wsFolders = vscode.workspace.workspaceFolders;
        if (!wsFolders || wsFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace open to setup MCP.');
            return;
        }
        const mcpPath = vscode.Uri.joinPath(wsFolders[0].uri, '.vscode', 'mcp.json');
        try {
            await vscode.workspace.fs.stat(mcpPath);
            vscode.window.showInformationMessage('.vscode/mcp.json already exists!');
            const doc = await vscode.workspace.openTextDocument(mcpPath);
            vscode.window.showTextDocument(doc);
        }
        catch {
            const exampleConfig = {
                mcpServers: {
                    "example-server": {
                        command: "npx",
                        args: ["-y", "@modelcontextprotocol/server-everything"]
                    }
                }
            };
            const encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(mcpPath, encoder.encode(JSON.stringify(exampleConfig, null, 2)));
            vscode.window.showInformationMessage('Created example .vscode/mcp.json for MCP configuration.');
            const doc = await vscode.workspace.openTextDocument(mcpPath);
            vscode.window.showTextDocument(doc);
        }
    }));
    // 10. Clean Disposal
    context.subscriptions.push({
        dispose: () => logger.dispose()
    });
    logger.log('Chanakya AI Enhancer successfully activated (Phases 1-5 ready).');
}
function deactivate() {
    logger_1.Logger.getInstance().log('Chanakya AI Enhancer extension deactivated.');
}
//# sourceMappingURL=extension.js.map