import * as vscode from 'vscode';
import { InlineCompletionProvider } from './providers/inlineCompletionProvider';
import { InlineEditProvider } from './providers/inlineEditProvider';
import { SidebarProvider } from './providers/sidebarProvider';
import { DashboardProvider } from './providers/dashboardProvider';
import { ConfigManager } from './services/configManager';
import { ContextItem } from './types/ipc';
import { Logger } from './utils/logger';
import { InlineEditCommand } from './commands/inlineEdit';

/**
 * Chanakya AI Enhancer Extension Activation Entrypoint (Phases 1-5 Complete)
 */
export function activate(context: vscode.ExtensionContext): void {
  const logger = Logger.getInstance();
  logger.log('Activating Chanakya AI Enhancer (Full Continue/Copilot Engine with FIM Autocomplete)...');

  // 1. Initialize Configuration Manager
  const configManager = ConfigManager.getInstance();

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
