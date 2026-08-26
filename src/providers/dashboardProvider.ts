import * as vscode from 'vscode';
import * as path from 'path';
import { ConfigManager } from '../services/configManager';
import { FromWebviewMessage, ToWebviewMessage } from '../types/ipc';
import { Logger } from '../utils/logger';
import { SecurityUtils } from '../utils/security';
import { GraphifyService } from '../services/graphifyService';

export class DashboardProvider {
  public static readonly viewType = 'chanakya-models-hub';

  private _panel: vscode.WebviewPanel | undefined;
  private readonly _extensionUri: vscode.Uri;
  private readonly _context: vscode.ExtensionContext;
  private readonly _logger = Logger.getInstance();
  private readonly _configManager = ConfigManager.getInstance();

  constructor(extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
    this._extensionUri = extensionUri;
    this._context = context;
  }

  private _initialTab: string | undefined;

  public show(args?: { tab?: string }): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (this._panel) {
      this._panel.reveal(column);
      if (args?.tab === 'settings') {
        this.postMessage({ type: 'openSettingsTab' });
      } else if (args?.tab === 'graphify') {
        this.postMessage({ type: 'openGraphifyView' });
      }
      return;
    }

    this._initialTab = args?.tab;

    this._panel = vscode.window.createWebviewPanel(
      DashboardProvider.viewType,
      'Chanakya Architecture & Models Hub',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this._extensionUri]
      }
    );

    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

    if (args?.tab === 'settings') {
      setTimeout(() => {
        this.postMessage({ type: 'openSettingsTab' });
      }, 500);
    } else if (args?.tab === 'graphify') {
      setTimeout(() => {
        this.postMessage({ type: 'openGraphifyView' });
      }, 500);
    }

    this._panel.onDidDispose(
      () => {
        this._panel = undefined;
      },
      null,
      []
    );

    this._panel.webview.onDidReceiveMessage(async (message: FromWebviewMessage) => {
      await this._handleWebviewMessage(message);
    });
  }

  public postMessage(message: ToWebviewMessage): void {
    if (this._panel) {
      this._panel.webview.postMessage(message);
    }
  }

  private async _handleWebviewMessage(message: FromWebviewMessage): Promise<void> {
    this._logger.log(`Received message from Dashboard Webview: ${message.type}`);

    switch (message.type) {
      case 'ready':
      case 'getConfig': {
        const config = this._configManager.getConfig();
        const rawYaml = this._configManager.getRawYaml();
        this.postMessage({
          type: 'configResult',
          payload: { config, rawYaml }
        });
        
        if (message.type === 'ready' && this._initialTab === 'settings') {
          this.postMessage({ type: 'openSettingsTab' });
          this._initialTab = undefined;
        }
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
          vscode.window.showInformationMessage('Chanakya AI Agent: Model configuration saved successfully!');
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

      case 'getVscodeSettings': {
        const config = vscode.workspace.getConfiguration('aiEnhancer');
        const settings = {
          model: config.get('model'),
          maxTokens: config.get('maxTokens'),
          temperature: config.get('temperature'),
          autoContextExtraction: config.get('autoContextExtraction'),
          systemPrompt: config.get('systemPrompt'),
          'autocomplete.enabled': config.get('autocomplete.enabled'),
          'autocomplete.model': config.get('autocomplete.model'),
          'autocomplete.debounceMs': config.get('autocomplete.debounceMs'),
          'chat.historySize': config.get('chat.historySize'),
          'enableGitSnapshots': config.get('enableGitSnapshots'),
        };
        this.postMessage({
          type: 'vscodeSettingsResult',
          payload: { settings }
        });
        break;
      }

      case 'updateVscodeSetting': {
        try {
          const { key, value } = message.payload;
          const config = vscode.workspace.getConfiguration('aiEnhancer');
          await config.update(key, value, vscode.ConfigurationTarget.Global);
          
          // Re-fetch and send back to confirm
          const updatedSettings = {
            model: config.get('model'),
            maxTokens: config.get('maxTokens'),
            temperature: config.get('temperature'),
            autoContextExtraction: config.get('autoContextExtraction'),
            systemPrompt: config.get('systemPrompt'),
            'autocomplete.enabled': config.get('autocomplete.enabled'),
            'autocomplete.model': config.get('autocomplete.model'),
            'autocomplete.debounceMs': config.get('autocomplete.debounceMs'),
            'chat.historySize': config.get('chat.historySize'),
            'enableGitSnapshots': config.get('enableGitSnapshots'),
          };
          this.postMessage({
            type: 'vscodeSettingsResult',
            payload: { settings: updatedSettings }
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          this.postMessage({ type: 'setError', payload: { error: errMsg } });
          vscode.window.showErrorMessage(`Failed to update setting: ${errMsg}`);
        }
        break;
      }

      case 'openConfigFile': {
        const filePath = this._configManager.getConfigFilePath();
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);
        break;
      }

      case 'getTokenStats': {
        const stats = this._context.globalState.get<Record<string, unknown>>('chanakya.tokenStats') || {};
        const history = this._context.globalState.get<any[]>('chanakya.tokenHistory') || [];
        this._panel?.webview.postMessage({ type: 'tokenStatsResult', payload: { stats, history } });
        break;
      }

      case 'clearTokenStats': {
        await this._context.globalState.update('chanakya.tokenStats', {});
        await this._context.globalState.update('chanakya.tokenHistory', []);
        this._panel?.webview.postMessage({ type: 'tokenStatsResult', payload: { stats: {}, history: [] } });
        break;
      }

      case 'getTokenOptimizerConfig': {
        const cfg = this._context.globalState.get<Record<string, unknown>>('chanakya.tokenOptimizerConfig') || {};
        this._panel?.webview.postMessage({ type: 'tokenOptimizerConfig', payload: cfg });
        break;
      }

      case 'saveTokenOptimizerConfig': {
        await this._context.globalState.update('chanakya.tokenOptimizerConfig', message.payload);
        break;
      }

      case 'getGraphifyData': {
        try {
          const forceRefresh = !!message.payload?.refresh;
          const graphData = await GraphifyService.getInstance().generateGraphData(forceRefresh);
          this.postMessage({
            type: 'graphifyDataResult',
            payload: { data: graphData }
          });
        } catch (err: any) {
          this._logger.error('Failed to generate graphify data in dashboard', err);
          vscode.window.showErrorMessage(`Failed to generate graph: ${err.message}`);
        }
        break;
      }

      case 'openFileInEditor': {
        try {
          const filePath = message.payload.filePath;
          const wsFolders = vscode.workspace.workspaceFolders;
          const fullPath = path.isAbsolute(filePath)
            ? filePath
            : wsFolders && wsFolders.length > 0
            ? path.join(wsFolders[0].uri.fsPath, filePath)
            : filePath;

          const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(fullPath));
          await vscode.window.showTextDocument(doc, { preview: false });
        } catch (err: any) {
          vscode.window.showErrorMessage(`Could not open file: ${err.message}`);
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
    <title>Chanakya Models Hub</title>
    <link href="${styleUri}" rel="stylesheet">
    <script nonce="${nonce}">
      window.CHANAKYA_VIEW_MODE = 'dashboard';
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
    <div id="root" class="absolute inset-0 h-full w-full" data-view-mode="dashboard"></div>
    <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
  </body>
</html>`;
  }
}
