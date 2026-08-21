import * as vscode from 'vscode';
import { InlineCompletionProvider } from './providers/inlineCompletionProvider';
import { InlineEditProvider } from './providers/inlineEditProvider';
import { SidebarProvider } from './providers/sidebarProvider';
import { DashboardProvider } from './providers/dashboardProvider';
import { ConfigManager } from './services/configManager';
import { McpService } from './services/mcpService';
import { ContextItem } from './types/ipc';
import { Logger } from './utils/logger';
import { InlineEditCommand } from './commands/inlineEdit';
import { VectorStore } from './services/memory/VectorStore';
import { ConversationManager } from './services/ConversationManager';
import { EvaluationService } from './services/evaluationService';
import { WorkspaceIndexer } from './services/workspaceIndexer';
import { GraphifyService } from './services/graphifyService';
/**
 * Chanakya AI Enhancer Extension Activation Entrypoint (Phases 1-5 Complete)
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const logger = Logger.getInstance();
  logger.log('Activating Chanakya AI Enhancer (Full Continue/Copilot Engine with FIM Autocomplete)...');

  // 1. Initialize Configuration Manager
  const configManager = ConfigManager.getInstance();

  // Initialize Conversation Manager
  ConversationManager.initialize(context);
  
  // Initialize EvaluationService
  EvaluationService.getInstance().initialize(context);

  // 1.5 Initialize MCP Client & Auto-Discovery
  const mcpService = McpService.getInstance();
  const wsFolders = vscode.workspace.workspaceFolders;
  if (wsFolders && wsFolders.length > 0) {
    mcpService.loadConfig(wsFolders[0].uri.fsPath);
  }

  // 1.8 Initialize Vector Database for Memory RAG
  const vectorStore = VectorStore.getInstance();
  vectorStore.initialize(context.globalStorageUri);

  // 1.9 Register Graphify Incremental Watcher
  GraphifyService.getInstance().registerIncrementalWatcher(context);

  // 2. Register Sidebar Provider (Replaces Full Screen Dashboard)
  const sidebarProvider = new SidebarProvider(context.extensionUri, context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarProvider.viewType,
      sidebarProvider,
      {
        webviewOptions: { retainContextWhenHidden: true }
      }
    )
  );

  // 2.5 Phase 2: Inline Edit (Cmd+I)
  const inlineEditProvider = new InlineEditProvider();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(InlineEditProvider.scheme, inlineEditProvider)
  );

  const inlineEditCmd = new InlineEditCommand(inlineEditProvider);
  context.subscriptions.push(
    vscode.commands.registerCommand('aiEnhancer.inlineEdit', async () => {
      await inlineEditCmd.handleInlineEdit();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('aiEnhancer.acceptEdit', async () => {
      await inlineEditCmd.handleAcceptEdit();
    })
  );

  // 3. Register Phase 5: Inline Autocomplete Provider (FIM)
  const inlineProvider = new InlineCompletionProvider();
  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      { pattern: '**' },
      inlineProvider
    )
  );

  // 4. Register Command: Toggle Autocomplete
  context.subscriptions.push(
    vscode.commands.registerCommand('aiEnhancer.toggleAutocomplete', () => {
      const isEnabled = inlineProvider.toggle();
      vscode.window.showInformationMessage(
        `Chanakya AI Enhancer: Inline Autocomplete is now ${isEnabled ? 'ENABLED' : 'DISABLED'}`
      );
      updateStatusBar();
    })
  );

  // 5. Register Command: Add Active Selection to Context (Cmd+Alt+L / Ctrl+Alt+L)
  context.subscriptions.push(
    vscode.commands.registerCommand('aiEnhancer.addSelectionToContext', () => {
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

      const contextItem: ContextItem = {
        id: `sel-${Date.now()}`,
        type: 'selection',
        name: `${fileName} (${startLine}-${endLine})`,
        content: selectedText,
        path: document.fileName,
        range: { startLine, endLine }
      };

      sidebarProvider.addContextItem(contextItem);
      
      logger.log(`Added selection context item: ${contextItem.name}`);
    })
  );

  // 7. Register Command: Open config.yaml
  context.subscriptions.push(
    vscode.commands.registerCommand('aiEnhancer.openConfigYaml', async () => {
      const filePath = configManager.getConfigFilePath();
      const doc = await vscode.workspace.openTextDocument(filePath);
      await vscode.window.showTextDocument(doc);
    })
  );

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
  const dashboardProvider = new DashboardProvider(context.extensionUri, context);
  context.subscriptions.push(
    vscode.commands.registerCommand('aiEnhancer.openModelsHub', (args?: { tab?: string }) => {
      dashboardProvider.show(args);
    }),
    vscode.commands.registerCommand('aiEnhancer.openGraphify', () => {
      dashboardProvider.show({ tab: 'graphify' });
    }),
    vscode.commands.registerCommand('aiEnhancer.generateArchitecture', async () => {
      try {
        const outPath = await WorkspaceIndexer.getInstance().generateArchitectureMap();
        vscode.window.showInformationMessage(`Workspace architecture generated at: ${outPath}`);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to generate architecture: ${err.message}`);
      }
    }),
    vscode.commands.registerCommand('aiEnhancer.setupMcp', async () => {
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
      } catch {
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
    })
  );

  // 10. Clean Disposal
  context.subscriptions.push({
    dispose: () => logger.dispose()
  });

  logger.log('Chanakya AI Enhancer successfully activated (Phases 1-5 ready).');
}

export function deactivate(): void {
  Logger.getInstance().log('Chanakya AI Enhancer extension deactivated.');
}
