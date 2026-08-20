import { AppConfig, ModelConfig } from './config';

export interface ContextItem {
  readonly id: string;
  readonly type: 'file' | 'selection' | 'terminal' | 'codebase';
  readonly name: string;
  readonly content: string;
  readonly path?: string | undefined;
  readonly range?: {
    readonly startLine: number;
    readonly endLine: number;
  } | undefined;
}

export interface TaskStatus {
  readonly id: string;
  readonly status: 'running' | 'done' | 'error';
  readonly label: string;
  readonly durationMs?: number | undefined;
}

export interface ChatMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
  readonly contextItems?: ContextItem[] | undefined;
  readonly isStreaming?: boolean | undefined;
  readonly timestamp: number;
  readonly taskStatuses?: TaskStatus[] | undefined;
  readonly optimizationStats?: {
    readonly originalTokens: number;
    readonly optimizedTokens: number;
  } | undefined;
}

export interface Conversation {
  readonly id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export interface WorkspaceFileResult {
  readonly label: string;
  readonly path: string;
}

export interface DetectedLocalModel {
  readonly name: string;
  readonly model: string;
  readonly provider: 'ollama' | 'lmstudio';
  readonly apiBase: string;
  readonly size?: string | undefined;
}

/**
 * Messages sent FROM React Webview TO Extension Host
 */
export type FromWebviewMessage =
  | { type: 'ready' }
  | { type: 'sendMessage'; payload: { text: string; contextItems: ContextItem[] } }
  | { type: 'abortGeneration'; payload?: { messageId?: string } }
  | { type: 'searchWorkspaceFiles'; payload: { query: string } }
  | { type: 'readFileContent'; payload: { path: string } }
  | { type: 'insertCode'; payload: { code: string } }
  | { type: 'applyCodeMerge'; payload: { code: string } }
  | { type: 'copyToClipboard'; payload: { text: string } }
  | { type: 'openSettings' }
  | { type: 'openModelsHub' }
  | { type: 'clearChat' }
  | { type: 'getConfig' }
  | { type: 'getVscodeSettings' }
  | { type: 'updateVscodeSetting'; payload: { key: string; value: any } }
  | { type: 'saveConfig'; payload: { config: AppConfig; rawYaml?: string | undefined } }
  | { type: 'testModelConnection'; payload: { modelConfig: ModelConfig } }
  | { type: 'detectLocalModels' }
  | { type: 'openConfigFile' }
  | { type: 'readTerminalContent' }
  | { type: 'generateCommitMessage' }
  | { type: 'getTokenStats' }
  | { type: 'clearTokenStats' }
  | { type: 'getTokenOptimizerConfig' }
  | { type: 'revertSnapshot' }
  | { type: 'saveTokenOptimizerConfig'; payload: Record<string, unknown> }
  | { type: 'loadConversations' }
  | { type: 'loadConversation'; payload: { id: string } }
  | { type: 'newConversation' }
  | { type: 'deleteConversation'; payload: { id: string } }
  | { type: 'clearAllConversations' }
  | { type: 'openFilePicker' };

/**
 * Messages sent FROM Extension Host TO React Webview
 */
export type ToWebviewMessage =
  | { type: 'addMessage'; payload: ChatMessage }
  | { type: 'streamChunk'; payload: { messageId: string; chunk: string } }
  | { type: 'streamEnd'; payload: { messageId: string } }
  | { type: 'addContextItem'; payload: ContextItem }
  | { type: 'workspaceFilesResult'; payload: { query: string; files: WorkspaceFileResult[] } }
  | { type: 'fileContentResult'; payload: { contextItem: ContextItem } }
  | { type: 'setLoading'; payload: { isLoading: boolean } }
  | { type: 'setError'; payload: { error: string } }
  | { type: 'clearChat' }
  | { type: 'configResult'; payload: { config: AppConfig; rawYaml: string } }
  | { type: 'vscodeSettingsResult'; payload: { settings: Record<string, any> } }
  | { type: 'testModelResult'; payload: { modelId: string; success: boolean; latencyMs?: number | undefined; error?: string | undefined } }
  | { type: 'updateTaskStatus'; payload: { messageId: string; task: TaskStatus } }
  | { type: 'openSettingsTab' }
  | { type: 'localModelsDetected'; payload: { models: DetectedLocalModel[] } }
  | { type: 'optimizationStats'; payload: { messageId: string; originalTokens: number; optimizedTokens: number; evaluationScore?: number } }
  | { type: 'tokenStatsResult'; payload: Record<string, unknown> }
  | { type: 'tokenOptimizerConfig'; payload: Record<string, unknown> }
  | { type: 'conversationsLoaded'; payload: { conversations: Conversation[]; activeId: string | null } }
  | { type: 'activeConversationChanged'; payload: { conversation: Conversation } }
  | { type: 'fileAttached'; payload: { name: string; path: string; content: string } };
