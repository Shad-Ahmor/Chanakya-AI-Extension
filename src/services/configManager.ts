import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as YAML from 'yaml';
import { AppConfig, ModelConfig } from '../types/config';
import { DetectedLocalModel } from '../types/ipc';
import { Logger } from '../utils/logger';

/**
 * ConfigManager handles config.yaml loading, parsing, auto-detection of local models,
 * connection tests, and synchronization between IDE & Webview UI.
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private readonly logger = Logger.getInstance();
  private readonly configDir: string;
  private readonly configFilePath: string;
  private currentConfig: AppConfig;

  private constructor() {
    this.configDir = path.join(os.homedir(), '.chanakya-ai-enhancer');
    this.configFilePath = path.join(this.configDir, 'config.yaml');

    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }

    this.currentConfig = this.loadOrCreateDefaultConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  public getConfigFilePath(): string {
    return this.configFilePath;
  }

  public getConfig(): AppConfig {
    return this.currentConfig;
  }

  public getRawYaml(): string {
    try {
      if (fs.existsSync(this.configFilePath)) {
        return fs.readFileSync(this.configFilePath, 'utf-8');
      }
    } catch (err) {
      this.logger.error('Failed to read config.yaml', err);
    }
    return YAML.stringify(this.currentConfig);
  }

  public saveConfig(config: AppConfig, rawYaml?: string): void {
    try {
      this.currentConfig = config;
      const yamlContent = rawYaml || YAML.stringify(config);
      fs.writeFileSync(this.configFilePath, yamlContent, 'utf-8');
      this.logger.log(`Configuration saved to ${this.configFilePath}`);
    } catch (err) {
      this.logger.error('Failed to save config.yaml', err);
      throw err;
    }
  }

  public saveRawYaml(yamlText: string): AppConfig {
    try {
      const parsed = YAML.parse(yamlText) as Partial<AppConfig>;
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.models)) {
        throw new Error('Invalid config.yaml structure: "models" list is required.');
      }

      const validatedModels: ModelConfig[] = parsed.models.map((m, idx) => ({
        ...m,
        id: m.id || `model-${idx}-${m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
      }));

      const validatedConfig: AppConfig = {
        name: parsed.name || 'Main Config',
        version: parsed.version || '1.0.0',
        schema: parsed.schema || 'v1',
        activeChatModelId: parsed.activeChatModelId || validatedModels[0]?.id,
        activeAutocompleteModelId: parsed.activeAutocompleteModelId || validatedModels[0]?.id,
        models: validatedModels
      };

      this.currentConfig = validatedConfig;
      fs.writeFileSync(this.configFilePath, yamlText, 'utf-8');
      this.logger.log(`Raw YAML configuration saved successfully.`);
      return validatedConfig;
    } catch (err) {
      this.logger.error('Failed to parse or save raw YAML', err);
      throw err;
    }
  }

  /**
   * Tests ping / connection to the given model endpoint.
   */
  public async testModelConnection(model: ModelConfig): Promise<{ success: boolean; latencyMs?: number; error?: string }> {
    const startTime = Date.now();
    try {
      const apiBase = model.apiBase || 'https://api.openai.com/v1';
      let endpoint = `${apiBase.replace(/\/+$/, '')}/models`;

      // For custom endpoints or Ollama, endpoint fallback
      if (model.provider === 'ollama' && !endpoint.includes('/api/tags')) {
        const base = apiBase.replace(/\/v1\/?$/, '').replace(/\/+$/, '');
        endpoint = `${base}/api/tags`;
      }

      const headers: Record<string, string> = {
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
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, latencyMs, error: message };
    }
  }

  /**
   * Detects locally running Ollama & LM Studio instances and lists installed models.
   */
  public async detectLocalModels(): Promise<DetectedLocalModel[]> {
    const detected: DetectedLocalModel[] = [];

    // 1. Check Ollama (http://localhost:11434/api/tags)
    try {
      const ollamaRes = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
      if (ollamaRes.ok) {
        const data = await ollamaRes.json() as { models?: Array<{ name: string; size?: number }> };
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
    } catch {
      // Ollama not running
    }

    // 2. Check LM Studio / Local vLLM (http://localhost:1234/v1/models)
    try {
      const lmStudioRes = await fetch('http://localhost:1234/v1/models', { signal: AbortSignal.timeout(2000) });
      if (lmStudioRes.ok) {
        const data = await lmStudioRes.json() as { data?: Array<{ id: string }> };
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
    } catch {
      // LM Studio not running
    }

    return detected;
  }

  private loadOrCreateDefaultConfig(): AppConfig {
    if (fs.existsSync(this.configFilePath)) {
      try {
        const raw = fs.readFileSync(this.configFilePath, 'utf-8');
        const parsed = YAML.parse(raw) as Partial<AppConfig>;
        if (parsed && Array.isArray(parsed.models) && parsed.models.length > 0) {
          const models: ModelConfig[] = parsed.models.map((m, idx) => ({
            ...m,
            id: m.id || `model-${idx}-${m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
          }));

          return {
            name: parsed.name || 'Main Config',
            version: parsed.version || '1.0.0',
            schema: parsed.schema || 'v1',
            activeChatModelId: parsed.activeChatModelId || models[0]?.id,
            activeAutocompleteModelId: parsed.activeAutocompleteModelId || models[0]?.id,
            models
          };
        }
      } catch (err) {
        this.logger.error('Failed to parse existing config.yaml, recreating with user schema', err);
      }
    }

    // Exact user configuration schema
    const defaultModels: ModelConfig[] = [
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

    const defaultConfig: AppConfig = {
      name: 'Main Config',
      version: '1.0.0',
      schema: 'v1',
      activeChatModelId: 'ril-ai-foundry-qwen-27b',
      activeAutocompleteModelId: 'local-ollama-qwen',
      models: defaultModels
    };

    try {
      fs.writeFileSync(this.configFilePath, YAML.stringify(defaultConfig), 'utf-8');
      this.logger.log(`Initialized default config.yaml at ${this.configFilePath}`);
    } catch (err) {
      this.logger.error('Failed to write default config.yaml', err);
    }

    return defaultConfig;
  }
}
