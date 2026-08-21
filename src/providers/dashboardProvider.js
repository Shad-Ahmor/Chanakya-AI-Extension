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
exports.DashboardProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const configManager_1 = require("../services/configManager");
const logger_1 = require("../utils/logger");
const security_1 = require("../utils/security");
const graphifyService_1 = require("../services/graphifyService");
class DashboardProvider {
    static viewType = 'chanakya-models-hub';
    _panel;
    _extensionUri;
    _context;
    _logger = logger_1.Logger.getInstance();
    _configManager = configManager_1.ConfigManager.getInstance();
    constructor(extensionUri, context) {
        this._extensionUri = extensionUri;
        this._context = context;
    }
    _initialTab;
    show(args) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        if (this._panel) {
            this._panel.reveal(column);
            if (args?.tab === 'settings') {
                this.postMessage({ type: 'openSettingsTab' });
            }
            else if (args?.tab === 'graphify') {
                this.postMessage({ type: 'openGraphifyView' });
            }
            return;
        }
        this._initialTab = args?.tab;
        this._panel = vscode.window.createWebviewPanel(DashboardProvider.viewType, 'Chanakya Architecture & Models Hub', column || vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [this._extensionUri]
        });
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
        if (args?.tab === 'settings') {
            setTimeout(() => {
                this.postMessage({ type: 'openSettingsTab' });
            }, 500);
        }
        else if (args?.tab === 'graphify') {
            setTimeout(() => {
                this.postMessage({ type: 'openGraphifyView' });
            }, 500);
        }
        this._panel.onDidDispose(() => {
            this._panel = undefined;
        }, null, []);
        this._panel.webview.onDidReceiveMessage(async (message) => {
            await this._handleWebviewMessage(message);
        });
    }
    postMessage(message) {
        if (this._panel) {
            this._panel.webview.postMessage(message);
        }
    }
    async _handleWebviewMessage(message) {
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
                    }
                    else {
                        this._configManager.saveConfig(message.payload.config);
                        const rawYaml = this._configManager.getRawYaml();
                        this.postMessage({
                            type: 'configResult',
                            payload: { config: message.payload.config, rawYaml }
                        });
                    }
                    vscode.window.showInformationMessage('Chanakya AI Enhancer: Model configuration saved successfully!');
                }
                catch (err) {
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
                }
                catch (err) {
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
                const stats = this._context.globalState.get('chanakya.tokenStats') || {};
                const history = this._context.globalState.get('chanakya.tokenHistory') || [];
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
                const cfg = this._context.globalState.get('chanakya.tokenOptimizerConfig') || {};
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
                    const graphData = await graphifyService_1.GraphifyService.getInstance().generateGraphData(forceRefresh);
                    this.postMessage({
                        type: 'graphifyDataResult',
                        payload: { data: graphData }
                    });
                }
                catch (err) {
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
                }
                catch (err) {
                    vscode.window.showErrorMessage(`Could not open file: ${err.message}`);
                }
                break;
            }
        }
    }
    _getHtmlForWebview(webview) {
        const nonce = security_1.SecurityUtils.generateNonce();
        const csp = security_1.SecurityUtils.getWebviewCsp(webview, nonce);
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
exports.DashboardProvider = DashboardProvider;
//# sourceMappingURL=dashboardProvider.js.map