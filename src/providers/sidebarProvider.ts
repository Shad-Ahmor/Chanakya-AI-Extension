import * as vscode from 'vscode';
import { ConfigManager } from '../services/configManager';
import { LLMEngine } from '../services/llmEngine';
import { ContextItem, FromWebviewMessage, ToWebviewMessage } from '../types/ipc';
import { Logger } from '../utils/logger';
import { SecurityUtils } from '../utils/security';
import { ConversationManager } from '../services/ConversationManager';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'chanakya-ai-launcher';

  private _view?: vscode.WebviewView;
  private readonly _extensionUri: vscode.Uri;
  private readonly _context: vscode.ExtensionContext;
  private readonly _logger = Logger.getInstance();
  private readonly _configManager = ConfigManager.getInstance();
  private readonly _conversationManager = ConversationManager.getInstance();
  private _activeCts?: vscode.CancellationTokenSource | undefined;
  
  constructor(extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
    this._extensionUri = extensionUri;
    this._context = context;
    
    // Listen for external changes to config.yaml (Two-way sync)
    this._context.subscriptions.push(
      this._configManager.onDidChangeConfig((newConfig) => {
        if (this._view) {
          const rawYaml = this._configManager.getRawYaml();
          this.postMessage({
            type: 'configResult',
            payload: { config: newConfig, rawYaml }
          });
        }
      })
    );
  }

  /** Persist token usage per model to globalState */
  private async _saveTokenUsage(
    modelId: string, 
    promptTokens: number, 
    completionTokens: number,
    durationMs: number = 0,
    ttftMs: number = 0,
    isError: boolean = false
  ): Promise<void> {
    const key = 'chanakya.tokenStats';
    const existing = this._context.globalState.get<Record<string, { promptTokens: number; completionTokens: number; requests: number }>>(key) || {};
    const prev = existing[modelId] || { promptTokens: 0, completionTokens: 0, requests: 0 };
    existing[modelId] = {
      promptTokens: prev.promptTokens + promptTokens,
      completionTokens: prev.completionTokens + completionTokens,
      requests: prev.requests + 1,
    };
    await this._context.globalState.update(key, existing);

    // Save time-series history
    const historyKey = 'chanakya.tokenHistory';
    const history = this._context.globalState.get<any[]>(historyKey) || [];
    history.push({
      timestamp: Date.now(),
      modelId,
      promptTokens,
      completionTokens,
      durationMs,
      ttftMs,
      isError
    });
    
    // Cap at 2000 items
    if (history.length > 2000) {
      history.splice(0, history.length - 2000);
    }
    await this._context.globalState.update(historyKey, history);
  }

  private _createGitSnapshot(promptText: string): void {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) return;
      const cwd = workspaceFolders[0].uri.fsPath;
      
      const config = vscode.workspace.getConfiguration('aiEnhancer');
      if (config.get('enableGitSnapshots') === false) {
        return; // Disabled by user
      }
      
      const fs = require('fs');
      const path = require('path');
      if (!fs.existsSync(path.join(cwd, '.git'))) {
        return; // Not a git repository
      }

      const cp = require('child_process');

      // Stage everything
      cp.execSync('git add .', { cwd, stdio: 'ignore' });
      
      // Check if there are changes to commit
      const status = cp.execSync('git status --porcelain', { cwd }).toString();
      if (status.trim() !== '') {
        const snippet = promptText.substring(0, 30).replace(/"/g, "'").replace(/\n/g, ' ');
        const commitMsg = `🤖 Chanakya AI Snapshot: ${snippet}...`;
        cp.execSync(`git commit -m "${commitMsg}" --no-verify`, { cwd, stdio: 'ignore' });
        this._logger.log(`Created Git Snapshot: ${commitMsg}`);
      }
    } catch (e) {
      this._logger.error('Failed to create Git snapshot', e);
    }
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'dist')]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message: FromWebviewMessage) => {
      await this._handleWebviewMessage(message);
    });
  }

  public postMessage(message: ToWebviewMessage): void {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  public addContextItem(item: ContextItem): void {
    if (this._view) {
      this._view.show?.(true); 
      this.postMessage({
        type: 'addContextItem',
        payload: item
      });
    } else {
      vscode.window.showInformationMessage('Please open the Chanakya AI sidebar first.');
    }
  }

  public clearChat(): void {
    this.postMessage({ type: 'clearChat' });
  }

  private async _handleWebviewMessage(message: FromWebviewMessage): Promise<void> {
    this._logger.log(`Received message from Webview: ${message.type}`);

    switch (message.type) {
      case 'ready': {
        this._logger.log('React Webview reported READY state.');
        const config = this._configManager.getConfig();
        const rawYaml = this._configManager.getRawYaml();
        this.postMessage({
          type: 'configResult',
          payload: { config, rawYaml }
        });
        
        // Also send conversations on ready
        this.postMessage({
          type: 'conversationsLoaded',
          payload: {
            conversations: this._conversationManager.getAllConversations(),
            activeId: this._conversationManager.getActiveConversationId()
          }
        });
        break;
      }

      case 'getConfig': {
        const config = this._configManager.getConfig();
        const rawYaml = this._configManager.getRawYaml();
        this.postMessage({
          type: 'configResult',
          payload: { config, rawYaml }
        });
        break;
      }

      case 'saveConfig': {
        try {
          if (message.payload.rawYaml) {
            const updatedConfig = this._configManager.saveRawYaml(message.payload.rawYaml);
            this.postMessage({
              type: 'configResult',
              payload: { config: updatedConfig, rawYaml: message.payload.rawYaml }
            });
          } else {
            this._configManager.saveConfig(message.payload.config);
            const rawYaml = this._configManager.getRawYaml();
            this.postMessage({
              type: 'configResult',
              payload: { config: message.payload.config, rawYaml }
            });
          }
          vscode.window.showInformationMessage('Chanakya AI Enhancer: Model configuration saved successfully!');
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          this.postMessage({ type: 'setError', payload: { error: errMsg } });
          vscode.window.showErrorMessage(`Failed to save config: ${errMsg}`);
        }
        break;
      }

      case 'testModelConnection': {
        const result = await this._configManager.testModelConnection(message.payload.modelConfig);
        this.postMessage({
          type: 'testModelResult',
          payload: {
            modelId: message.payload.modelConfig.id || message.payload.modelConfig.name,
            success: result.success,
            latencyMs: result.latencyMs,
            error: result.error
          }
        });
        break;
      }

      case 'detectLocalModels': {
        const detected = await this._configManager.detectLocalModels();
        this.postMessage({
          type: 'localModelsDetected',
          payload: { models: detected }
        });
        break;
      }

      case 'openConfigFile': {
        const filePath = this._configManager.getConfigFilePath();
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);
        break;
      }

      case 'searchWorkspaceFiles': {
        const query = message.payload.query;
        const files = await vscode.workspace.findFiles(`**/*${query}*`, '**/node_modules/**', 20);
        const results = files.map((file) => ({
          label: vscode.workspace.asRelativePath(file),
          path: file.fsPath
        }));
        this.postMessage({
          type: 'workspaceFilesResult',
          payload: { query, files: results }
        });
        break;
      }

      case 'generateCommitMessage': {
        const cp = require('child_process');
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
          vscode.window.showErrorMessage('No workspace folder open for git.');
          break;
        }

        const cwd = workspaceFolders[0].uri.fsPath;
        
        cp.exec('git diff --cached', { cwd, maxBuffer: 1024 * 1024 * 10 }, async (_err: any, stdout: string) => {
          let diff = stdout;
          
          if (!diff || diff.trim() === '') {
            try {
              diff = cp.execSync('git diff', { cwd, maxBuffer: 1024 * 1024 * 10 }).toString();
            } catch (e) {}
          }

          if (!diff || diff.trim() === '') {
            vscode.window.showInformationMessage('Chanakya AI: No git diff found to generate commit message.');
            return;
          }

          if (diff.length > 50000) {
            diff = diff.substring(0, 50000) + '\n\n... [Diff Truncated]';
          }

          const prompt = `You are an expert developer. Generate a concise, conventional git commit message for the following diff. 
Reply ONLY with the commit message text. Do not include markdown blocks, greetings, or explanations.
Format: <type>(<scope>): <subject>

Diff:
${diff}`;

          try {
            vscode.window.withProgress(
              { location: vscode.ProgressLocation.Notification, title: 'Chanakya AI generating commit message...' },
              async () => {
                const llm = LLMEngine.getInstance();
                let commitMsg = '';
                await llm.streamChat({
                  prompt,
                  contextItems: [],
                  callbacks: {
                    onChunk: (chunk) => commitMsg += chunk,
                    onComplete: async (fullText) => { commitMsg = fullText; },
                    onError: (err) => { throw err; }
                  }
                });

                const gitExtension = vscode.extensions.getExtension('vscode.git');
                if (gitExtension) {
                  const api = gitExtension.isActive ? gitExtension.exports : await gitExtension.activate();
                  const gitApi = api.getAPI(1);
                  const repository = gitApi.repositories[0];
                  if (repository) {
                    repository.inputBox.value = commitMsg.trim();
                    vscode.window.showInformationMessage('Commit message generated!');
                    vscode.commands.executeCommand('workbench.view.scm'); 
                  }
                }
              }
            );
          } catch (e: any) {
            vscode.window.showErrorMessage(`Failed to generate commit message: ${e.message}`);
          }
        });
        break;
      }

      case 'sendMessage': {
        const { text, contextItems } = message.payload;
        const assistantMsgId = `asst-${Date.now()}`;

        // Create snapshot before AI runs
        this._createGitSnapshot(text);

        let enrichedContextItems = [...(contextItems || [])];
        const hasCodebase = enrichedContextItems.find(i => i.type === 'codebase');
        
        if (hasCodebase) {
          try {
            this.postMessage({ type: 'setLoading', payload: { isLoading: true } });
            const words = text.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter((w: string) => w.length > 4);
            const keywords = words.slice(0, 3);
            
            if (keywords.length > 0) {
              const globQuery = `**/*{${keywords.join(',')}}*`;
              const files = await vscode.workspace.findFiles(globQuery, '**/node_modules/**', 3);
              
              for (const file of files) {
                const bytes = await vscode.workspace.fs.readFile(file);
                enrichedContextItems.push({
                  id: `rag-${file.fsPath}`,
                  type: 'file',
                  name: vscode.workspace.asRelativePath(file),
                  content: Buffer.from(bytes).toString('utf-8').slice(0, 3000), 
                  path: file.fsPath
                });
              }
            }
          } catch (e) {
            this._logger.error('Codebase RAG failed', e);
          }
        }

        this.postMessage({
          type: 'addMessage',
          payload: {
            id: assistantMsgId,
            role: 'assistant',
            content: '',
            isStreaming: true,
            timestamp: Date.now()
          }
        });

        this.postMessage({ type: 'setLoading', payload: { isLoading: true } });

        if (this._activeCts) {
          this._activeCts.cancel();
          this._activeCts.dispose();
        }
        this._activeCts = new vscode.CancellationTokenSource();

        const tokenOptimizerRaw = this._context.globalState.get<Record<string, unknown>>('chanakya.tokenOptimizerConfig') || {};
        const activeModelId = this._configManager.getConfig().activeChatModelId || 'default';
        const activeModelConfig = tokenOptimizerRaw[activeModelId] || tokenOptimizerRaw['default'] || {};

        const activeId = this._conversationManager.getActiveConversationId();
        let existingMessages = activeId ? this._conversationManager.loadConversation(activeId)?.messages || [] : [];
        
        const userMessage = {
          id: `usr-${Date.now()}`,
          role: 'user',
          content: text,
          timestamp: Date.now()
        };

        await LLMEngine.getInstance().streamChat({
          prompt: text,
          contextItems: enrichedContextItems,
          optimizerConfig: activeModelConfig,
          cancellationToken: this._activeCts.token,
          existingMessages: existingMessages,
          callbacks: {
            onChunk: (chunk) => {
              this.postMessage({
                type: 'streamChunk',
                payload: { messageId: assistantMsgId, chunk }
              });
            },
            onComplete: (fullText) => {
              this.postMessage({
                type: 'streamEnd',
                payload: { messageId: assistantMsgId }
              });
              
              const finalMessages = [
                ...existingMessages,
                userMessage,
                {
                  id: assistantMsgId,
                  role: 'assistant',
                  content: fullText,
                  timestamp: Date.now()
                }
              ] as any[];
              
              const updatedConv = this._conversationManager.updateActiveConversation(finalMessages);
              this.postMessage({
                type: 'activeConversationChanged',
                payload: { conversation: updatedConv }
              });
              
              this.postMessage({ type: 'setLoading', payload: { isLoading: false } });
            },
            onError: (error) => {
              this.postMessage({
                type: 'streamChunk',
                payload: { messageId: assistantMsgId, chunk: `\n\n⚠️ **Error:** ${error.message}` }
              });
              this.postMessage({
                type: 'streamEnd',
                payload: { messageId: assistantMsgId }
              });
              
              const finalMessages = [
                ...existingMessages,
                userMessage,
                {
                  id: assistantMsgId,
                  role: 'assistant',
                  content: `⚠️ **Error:** ${error.message}`,
                  timestamp: Date.now()
                }
              ] as any[];
              
              const updatedConv = this._conversationManager.updateActiveConversation(finalMessages);
              this.postMessage({
                type: 'activeConversationChanged',
                payload: { conversation: updatedConv }
              });
              
              this.postMessage({ type: 'setLoading', payload: { isLoading: false } });
            },
            onTokensUsed: (modelId, promptTokens, completionTokens, durationMs, ttftMs, isError) => {
              this._saveTokenUsage(modelId, promptTokens, completionTokens, durationMs, ttftMs, isError).catch(() => { /* non-fatal */ });
            },
            onOptimizationStats: (originalTokens, optimizedTokens) => {
              this.postMessage({
                type: 'optimizationStats',
                payload: { messageId: assistantMsgId, originalTokens, optimizedTokens }
              });
            }
          }
        });
        break;
      }

      case 'abortGeneration': {
        if (this._activeCts) {
          this._activeCts.cancel();
          this._activeCts.dispose();
          this._activeCts = undefined;
        }
        this.postMessage({ type: 'setLoading', payload: { isLoading: false } });
        break;
      }

      case 'readFileContent': {
        try {
          const fileUri = vscode.Uri.file(message.payload.path);
          const bytes = await vscode.workspace.fs.readFile(fileUri);
          const content = Buffer.from(bytes).toString('utf-8');
          const fileName = message.payload.path.split('/').pop() || message.payload.path;

          this.postMessage({
            type: 'fileContentResult',
            payload: {
              contextItem: {
                id: `file-${Date.now()}`,
                type: 'file',
                name: fileName,
                path: message.payload.path,
                content: content
              }
            }
          });
        } catch (err) {
          this._logger.error('Failed to read file for context', err);
        }
        break;
      }

      case 'readTerminalContent': {
        try {
          if (!vscode.window.activeTerminal) {
            vscode.window.showWarningMessage('Chanakya AI: No active terminal found to read.');
            return;
          }
          
          const currentClipboard = await vscode.env.clipboard.readText();
          await vscode.commands.executeCommand('workbench.action.terminal.selectAll');
          await vscode.commands.executeCommand('workbench.action.terminal.copySelection');
          await vscode.commands.executeCommand('workbench.action.terminal.clearSelection');
          
          await new Promise(r => setTimeout(r, 200));
          const terminalText = await vscode.env.clipboard.readText();
          
          await vscode.env.clipboard.writeText(currentClipboard);
          
          this.postMessage({
            type: 'fileContentResult', 
            payload: {
              contextItem: {
                id: `terminal-${Date.now()}`,
                type: 'terminal',
                name: 'Terminal Output',
                path: 'Terminal',
                content: terminalText || 'Terminal is empty.'
              }
            }
          });
        } catch (err) {
          this._logger.error('Failed to read terminal content', err);
        }
        break;
      }

      case 'insertCode': {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          await editor.edit((builder) => {
            if (!editor.selection.isEmpty) {
              builder.replace(editor.selection, message.payload.code);
            } else {
              builder.insert(editor.selection.active, message.payload.code);
            }
          });
        }
        break;
      }

      case 'applyCodeMerge': {
        try {
          const editor = vscode.window.activeTextEditor;
          if (!editor) {
            vscode.window.showWarningMessage('Chanakya AI: Open a file first to apply code.');
            break;
          }
          
          const fs = require('fs');
          const os = require('os');
          const path = require('path');
          
          // Original file URI
          const originalUri = editor.document.uri;
          const originalContent = editor.document.getText();
          
          // Check if it's a snippet or full file. Simple heuristic: if it's much shorter, we replace selection if it exists.
          let proposedContent = message.payload.code;
          if (!editor.selection.isEmpty) {
            // Replace selection with proposed content
            const before = originalContent.substring(0, editor.document.offsetAt(editor.selection.start));
            const after = originalContent.substring(editor.document.offsetAt(editor.selection.end));
            proposedContent = before + proposedContent + after;
          }
          
          // Create temp file for the right side of the diff
          const tempFilePath = path.join(os.tmpdir(), `chanakya_apply_${Date.now()}_${path.basename(originalUri.fsPath)}`);
          fs.writeFileSync(tempFilePath, proposedContent, 'utf8');
          const tempUri = vscode.Uri.file(tempFilePath);
          
          // Open Diff View
          const title = `Chanakya AI Merge: ${path.basename(originalUri.fsPath)}`;
          await vscode.commands.executeCommand('vscode.diff', originalUri, tempUri, title);
          
        } catch (err: any) {
          this._logger.error('Failed to apply code merge', err);
          vscode.window.showErrorMessage(`Chanakya AI Merge Error: ${err.message}`);
        }
        break;
      }

      case 'copyToClipboard': {
        await vscode.env.clipboard.writeText(message.payload.text);
        vscode.window.showInformationMessage('Copied to clipboard!');
        break;
      }

      case 'openSettings': {
        vscode.commands.executeCommand('aiEnhancer.openModelsHub', { tab: 'settings' });
        break;
      }

      case 'openModelsHub': {
        vscode.commands.executeCommand('aiEnhancer.openModelsHub');
        break;
      }

      case 'clearChat': {
        this.clearChat();
        break;
      }

      case 'newConversation': {
        const newConv = this._conversationManager.createNewConversation();
        this.postMessage({
          type: 'activeConversationChanged',
          payload: { conversation: newConv }
        });
        this.postMessage({
          type: 'conversationsLoaded',
          payload: {
            conversations: this._conversationManager.getAllConversations(),
            activeId: newConv.id
          }
        });
        break;
      }

      case 'loadConversation': {
        const conv = this._conversationManager.loadConversation(message.payload.id);
        if (conv) {
          this.postMessage({
            type: 'activeConversationChanged',
            payload: { conversation: conv }
          });
        }
        break;
      }

      case 'deleteConversation': {
        this._conversationManager.deleteConversation(message.payload.id);
        const conversations = this._conversationManager.getAllConversations();
        const activeId = this._conversationManager.getActiveConversationId();
        this.postMessage({
          type: 'conversationsLoaded',
          payload: { conversations, activeId }
        });
        const activeConv = activeId ? this._conversationManager.loadConversation(activeId) : null;
        if (activeConv) {
          this.postMessage({
            type: 'activeConversationChanged',
            payload: { conversation: activeConv }
          });
        } else {
          this.postMessage({ type: 'clearChat' });
        }
        break;
      }

      case 'revertSnapshot': {
        try {
          const workspaceFolders = vscode.workspace.workspaceFolders;
          if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder open to revert.');
            break;
          }
          const cwd = workspaceFolders[0].uri.fsPath;
          
          const config = vscode.workspace.getConfiguration('aiEnhancer');
          if (config.get('enableGitSnapshots') === false) {
            vscode.window.showErrorMessage('Auto Git-Snapshots are disabled in settings.');
            break;
          }
          
          const fs = require('fs');
          const path = require('path');
          if (!fs.existsSync(path.join(cwd, '.git'))) {
            vscode.window.showErrorMessage('Current workspace is not a Git repository.');
            break;
          }

          const cp = require('child_process');
          
          // Revert to the last commit
          cp.execSync('git reset --hard HEAD~1', { cwd });
          vscode.window.showInformationMessage('Chanakya AI: Reverted successfully to previous snapshot.');
        } catch (e: any) {
          vscode.window.showErrorMessage(`Failed to revert: ${e.message}`);
        }
        break;
      }
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = SecurityUtils.generateNonce();
    const csp = SecurityUtils.getWebviewCsp(webview, nonce);

    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'index.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'index.css'));

    return `<!DOCTYPE html>
<html lang="en" class="h-full w-full">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Chanakya AI Assistant</title>
    <link href="${styleUri}" rel="stylesheet">
    <script nonce="${nonce}">
      window.onerror = function(msg, src, line, col, err) {
        document.body.innerHTML = '<div style="color:#f48771;padding:16px;font-family:monospace;background:#1e1e1e">'
          + '<h3 style="color:#f48771">⚠️ Chanakya AI — Runtime Error</h3>'
          + '<b>' + msg + '</b><br/><small>' + src + ':' + line + '</small>'
          + '<pre style="white-space:pre-wrap;margin-top:8px">' + (err ? err.stack : '') + '</pre>'
          + '</div>';
        return true;
      };
      window.addEventListener('unhandledrejection', function(e) {
        document.body.innerHTML = '<div style="color:#f48771;padding:16px;font-family:monospace;background:#1e1e1e">'
          + '<h3 style="color:#f48771">⚠️ Chanakya AI — Unhandled Promise Error</h3>'
          + '<pre>' + (e.reason ? e.reason.toString() : 'Unknown') + '</pre>'
          + '</div>';
      });
    </script>
  </head>
  <body class="bg-vscode-bg text-vscode-fg select-none overflow-hidden m-0 p-0 relative h-full w-full">
    <div id="root" class="absolute inset-0 h-full w-full"></div>
    <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
  </body>
</html>`;
  }
}

