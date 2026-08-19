import * as vscode from 'vscode';
import { ConfigManager } from '../services/configManager';
import { LLMEngine } from '../services/llmEngine';
import { ContextItem, FromWebviewMessage, ToWebviewMessage } from '../types/ipc';
import { Logger } from '../utils/logger';
import { SecurityUtils } from '../utils/security';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'chanakya-ai-launcher';

  private _view?: vscode.WebviewView;
  private readonly _extensionUri: vscode.Uri;
  private readonly _context: vscode.ExtensionContext;
  private readonly _logger = Logger.getInstance();
  private readonly _configManager = ConfigManager.getInstance();
  private _activeCts?: vscode.CancellationTokenSource | undefined;
  
  constructor(extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
    this._extensionUri = extensionUri;
    this._context = context;
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

        await LLMEngine.getInstance().streamChat({
          prompt: text,
          contextItems: enrichedContextItems,
          optimizerConfig: activeModelConfig,
          cancellationToken: this._activeCts.token,
          callbacks: {
            onChunk: (chunk) => {
              this.postMessage({
                type: 'streamChunk',
                payload: { messageId: assistantMsgId, chunk }
              });
            },
            onComplete: (_fullText) => {
              this.postMessage({
                type: 'streamEnd',
                payload: { messageId: assistantMsgId }
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
              this.postMessage({ type: 'setLoading', payload: { isLoading: false } });
            },
            onTokensUsed: (modelId, promptTokens, completionTokens, durationMs, ttftMs, isError) => {
              this._saveTokenUsage(modelId, promptTokens, completionTokens, durationMs, ttftMs, isError).catch(() => { /* non-fatal */ });
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

