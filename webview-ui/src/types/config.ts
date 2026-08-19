export type ModelProvider =
  | 'openai'
  | 'ollama'
  | 'anthropic'
  | 'gemini'
  | 'lmstudio'
  | 'vllm'
  | 'qwen'
  | 'deepseek'
  | 'meta'
  | 'mistral'
  | 'custom';

export type ModelRole = 'chat' | 'edit' | 'apply' | 'autocomplete';

export type ModelCapability = 'image_input' | 'tools' | 'fim' | 'json';

export type ModelExecutionMode = 'local' | 'online_api' | 'enterprise_foundry';

export interface TokenUsageRecord {
  timestamp: number;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  ttftMs: number;
  isError: boolean;
}


export interface ModelCompletionOptions {
  contextLength?: number;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

export interface ModelRequestOptions {
  headers?: Record<string, string>;
  extraBody?: Record<string, unknown>;
}

export interface ModelConfig {
  id?: string;
  name: string;
  provider: ModelProvider;
  model: string;
  apiBase?: string;
  apiKey?: string;
  isLocal?: boolean;
  executionMode?: ModelExecutionMode;
  roles?: ModelRole[];
  requestOptions?: ModelRequestOptions;
  defaultCompletionOptions?: ModelCompletionOptions;
  capabilities?: ModelCapability[];
  useLegacyCompletionsEndpoint?: boolean;
}

export interface AppConfig {
  name: string;
  version: string;
  schema: string;
  activeChatModelId?: string;
  activeAutocompleteModelId?: string;
  models: ModelConfig[];
}
