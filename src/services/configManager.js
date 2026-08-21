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
exports.ConfigManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const YAML = __importStar(require("yaml"));
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
/**
 * ConfigManager handles config.yaml loading, parsing, auto-detection of local models,
 * connection tests, and synchronization between IDE & Webview UI.
 */
class ConfigManager {
    static instance;
    logger = logger_1.Logger.getInstance();
    configDir;
    configFilePath;
    currentConfig;
    _onDidChangeConfig = new vscode.EventEmitter();
    onDidChangeConfig = this._onDidChangeConfig.event;
    _isWriting = false;
    constructor() {
        this.configDir = path.join(os.homedir(), '.chanakya-ai-enhancer');
        this.configFilePath = path.join(this.configDir, 'config.yaml');
        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir, { recursive: true });
        }
        this.currentConfig = this.loadOrCreateDefaultConfig();
        this.startWatchingConfig();
    }
    startWatchingConfig() {
        try {
            fs.watch(this.configFilePath, (eventType) => {
                if (eventType === 'change' && !this._isWriting) {
                    // Add a tiny debounce to avoid multiple triggers
                    setTimeout(() => {
                        try {
                            if (fs.existsSync(this.configFilePath)) {
                                const raw = fs.readFileSync(this.configFilePath, 'utf-8');
                                const parsed = YAML.parse(raw);
                                if (parsed && Array.isArray(parsed.models)) {
                                    this.currentConfig = parsed;
                                    this._onDidChangeConfig.fire(this.currentConfig);
                                    this.logger.log('Detected external change in config.yaml, reloaded config.');
                                }
                            }
                        }
                        catch (err) {
                            this.logger.error('Error reading config.yaml on external change', err);
                        }
                    }, 100);
                }
            });
        }
        catch (err) {
            this.logger.error('Could not watch config.yaml', err);
        }
    }
    static getInstance() {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }
    getConfigFilePath() {
        return this.configFilePath;
    }
    getConfig() {
        return this.currentConfig;
    }
    getRawYaml() {
        try {
            if (fs.existsSync(this.configFilePath)) {
                return fs.readFileSync(this.configFilePath, 'utf-8');
            }
        }
        catch (err) {
            this.logger.error('Failed to read config.yaml', err);
        }
        return YAML.stringify(this.currentConfig);
    }
    saveConfig(config, rawYaml) {
        try {
            this._isWriting = true;
            this.currentConfig = config;
            const yamlContent = rawYaml || YAML.stringify(config);
            fs.writeFileSync(this.configFilePath, yamlContent, 'utf-8');
            this.logger.log(`Configuration saved to ${this.configFilePath}`);
            this._onDidChangeConfig.fire(config);
            setTimeout(() => { this._isWriting = false; }, 500);
        }
        catch (err) {
            this._isWriting = false;
            this.logger.error('Failed to save config.yaml', err);
            throw err;
        }
    }
    saveRawYaml(yamlText) {
        try {
            const parsed = YAML.parse(yamlText);
            if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.models)) {
                throw new Error('Invalid config.yaml structure: "models" list is required.');
            }
            const validatedModels = parsed.models.map((m, idx) => ({
                ...m,
                id: m.id || `model-${idx}-${m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
            }));
            const validatedConfig = {
                name: parsed.name || 'Main Config',
                version: parsed.version || '1.0.0',
                schema: parsed.schema || 'v1',
                enableGitSnapshots: parsed.enableGitSnapshots ?? true,
                activeChatModelId: parsed.activeChatModelId || validatedModels[0]?.id,
                activeAutocompleteModelId: parsed.activeAutocompleteModelId || validatedModels[0]?.id,
                models: validatedModels
            };
            this._isWriting = true;
            this.currentConfig = validatedConfig;
            fs.writeFileSync(this.configFilePath, yamlText, 'utf-8');
            this.logger.log(`Raw YAML configuration saved successfully.`);
            this._onDidChangeConfig.fire(validatedConfig);
            setTimeout(() => { this._isWriting = false; }, 500);
            return validatedConfig;
        }
        catch (err) {
            this._isWriting = false;
            this.logger.error('Failed to parse or save raw YAML', err);
            throw err;
        }
    }
    /**
     * Tests ping / connection to the given model endpoint.
     */
    async testModelConnection(model) {
        const startTime = Date.now();
        try {
            const apiBase = model.apiBase || 'https://api.openai.com/v1';
            let endpoint = `${apiBase.replace(/\/+$/, '')}/models`;
            // For custom endpoints or Ollama, endpoint fallback
            if (model.provider === 'ollama' && !endpoint.includes('/api/tags')) {
                const base = apiBase.replace(/\/v1\/?$/, '').replace(/\/+$/, '');
                endpoint = `${base}/api/tags`;
            }
            const headers = {
                'Content-Type': 'application/json',
                ...(model.requestOptions?.headers || {})
            };
            if (model.apiKey && model.apiKey.trim().length > 0) {
                headers['Authorization'] = `Bearer ${model.apiKey.trim()}`;
            }
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 6000);
            const res = await fetch(endpoint, {
                method: 'GET',
                headers,
                signal: controller.signal
            });
            clearTimeout(timeout);
            const latencyMs = Date.now() - startTime;
            if (res.ok || res.status === 404 || res.status === 401 || res.status === 403) {
                if (res.status === 401) {
                    return { success: false, latencyMs, error: 'Authentication failed (401 Unauthorized)' };
                }
                return { success: true, latencyMs };
            }
            return { success: false, latencyMs, error: `Server responded with HTTP ${res.status}` };
        }
        catch (err) {
            const latencyMs = Date.now() - startTime;
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, latencyMs, error: message };
        }
    }
    /**
     * Detects locally running Ollama & LM Studio instances and lists installed models.
     */
    async detectLocalModels() {
        const detected = [];
        // 1. Check Ollama (http://localhost:11434/api/tags)
        try {
            const ollamaRes = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
            if (ollamaRes.ok) {
                const data = await ollamaRes.json();
                if (data.models && Array.isArray(data.models)) {
                    for (const m of data.models) {
                        const sizeInGb = m.size ? `${(m.size / (1024 * 1024 * 1024)).toFixed(1)} GB` : undefined;
                        detected.push({
                            name: `Ollama (${m.name})`,
                            model: m.name,
                            provider: 'ollama',
                            apiBase: 'http://localhost:11434/v1',
                            size: sizeInGb
                        });
                    }
                }
            }
        }
        catch {
            // Ollama not running
        }
        // 2. Check LM Studio / Local vLLM (http://localhost:1234/v1/models)
        try {
            const lmStudioRes = await fetch('http://localhost:1234/v1/models', { signal: AbortSignal.timeout(2000) });
            if (lmStudioRes.ok) {
                const data = await lmStudioRes.json();
                if (data.data && Array.isArray(data.data)) {
                    for (const m of data.data) {
                        detected.push({
                            name: `LM Studio (${m.id})`,
                            model: m.id,
                            provider: 'lmstudio',
                            apiBase: 'http://localhost:1234/v1'
                        });
                    }
                }
            }
        }
        catch {
            // LM Studio not running
        }
        return detected;
    }
    loadOrCreateDefaultConfig() {
        if (fs.existsSync(this.configFilePath)) {
            try {
                const raw = fs.readFileSync(this.configFilePath, 'utf-8');
                const parsed = YAML.parse(raw);
                if (parsed && Array.isArray(parsed.models) && parsed.models.length > 0) {
                    const models = parsed.models.map((m, idx) => ({
                        ...m,
                        id: m.id || `model-${idx}-${m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
                    }));
                    return {
                        name: parsed.name || 'Main Config',
                        version: parsed.version || '1.0.0',
                        schema: parsed.schema || 'v1',
                        enableGitSnapshots: parsed.enableGitSnapshots ?? true,
                        activeChatModelId: parsed.activeChatModelId || models[0]?.id,
                        activeAutocompleteModelId: parsed.activeAutocompleteModelId || models[0]?.id,
                        models
                    };
                }
            }
            catch (err) {
                this.logger.error('Failed to parse existing config.yaml, recreating with user schema', err);
            }
        }
        // Exact user configuration schema
        const defaultModels = [
            {
                id: 'openai-gpt-4-1',
                name: 'OpenAI GPT-4.1',
                provider: 'openai',
                model: 'gpt-4.1-2025-04-14',
                apiKey: '1234',
                apiBase: 'https://api.openai.com/v1',
                isLocal: false,
                executionMode: 'online_api',
                roles: ['chat', 'edit', 'apply'],
                defaultCompletionOptions: {
                    contextLength: 1047576,
                    maxTokens: 32768
                },
                useLegacyCompletionsEndpoint: false
            },
            {
                id: 'openai-o3',
                name: 'o3',
                provider: 'openai',
                model: 'o3',
                apiKey: '1234',
                apiBase: 'https://api.openai.com/v1',
                isLocal: false,
                executionMode: 'online_api',
                roles: ['chat'],
                defaultCompletionOptions: {
                    contextLength: 200000,
                    maxTokens: 100000
                },
                capabilities: ['image_input']
            },
            {
                id: 'openai-gpt-4-1-mini',
                name: 'OpenAI GPT-4.1 mini',
                provider: 'openai',
                model: 'gpt-4.1-mini-2025-04-14',
                apiKey: '1234',
                apiBase: 'https://api.openai.com/v1',
                isLocal: false,
                executionMode: 'online_api',
                roles: ['chat', 'edit', 'apply'],
                defaultCompletionOptions: {
                    contextLength: 1047576,
                    maxTokens: 32768
                },
                useLegacyCompletionsEndpoint: false
            },
            {
                id: 'local-ollama-qwen',
                name: 'Local Ollama (Qwen 2.5 Coder)',
                provider: 'ollama',
                model: 'qwen2.5-coder:7b',
                apiBase: 'http://localhost:11434/v1',
                isLocal: true,
                executionMode: 'local',
                roles: ['chat', 'edit', 'autocomplete'],
                defaultCompletionOptions: {
                    contextLength: 32768,
                    maxTokens: 4096
                },
                capabilities: ['fim']
            }
        ];
        const defaultConfig = {
            name: 'Main Config',
            version: '1.0.0',
            schema: 'v1',
            enableGitSnapshots: true,
            activeChatModelId: 'ril-ai-foundry-qwen-27b',
            activeAutocompleteModelId: 'local-ollama-qwen',
            models: defaultModels
        };
        try {
            fs.writeFileSync(this.configFilePath, YAML.stringify(defaultConfig), 'utf-8');
            this.logger.log(`Initialized default config.yaml at ${this.configFilePath}`);
        }
        catch (err) {
            this.logger.error('Failed to write default config.yaml', err);
        }
        return defaultConfig;
    }
}
exports.ConfigManager = ConfigManager;
//# sourceMappingURL=configManager.js.map