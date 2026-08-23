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
  readonly timestamp: number;
  readonly modelId: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly durationMs: number;
  readonly ttftMs: number;
  readonly isError: boolean;
  readonly evaluationScore?: number;
}


export interface ModelCompletionOptions {
  readonly contextLength?: number | undefined;
  readonly maxTokens?: number | undefined;
  readonly temperature?: number | undefined;
  readonly topP?: number | undefined;
}

export interface ModelRequestOptions {
  readonly headers?: Record<string, string> | undefined;
  readonly extraBody?: Record<string, unknown> | undefined;
}

export interface ModelConfig {
  readonly id?: string | undefined;
  readonly name: string;
  readonly provider: ModelProvider;
  readonly model: string;
  readonly apiBase?: string | undefined;
  readonly apiKey?: string | undefined;
  readonly isLocal?: boolean | undefined;
  readonly executionMode?: ModelExecutionMode | undefined;
  readonly roles?: readonly ModelRole[] | undefined;
  readonly requestOptions?: ModelRequestOptions | undefined;
  readonly defaultCompletionOptions?: ModelCompletionOptions | undefined;
  readonly capabilities?: readonly ModelCapability[] | undefined;
  readonly useLegacyCompletionsEndpoint?: boolean | undefined;
}

export interface AppConfig {
  readonly name: string;
  readonly version: string;
  readonly schema: string;
  readonly enableGitSnapshots?: boolean | undefined;
  readonly activeChatModelId?: string | undefined;
  readonly activeAutocompleteModelId?: string | undefined;
  readonly activeOptimizerModelId?: string | undefined;
  readonly models: readonly ModelConfig[];
}
