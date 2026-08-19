import { AppConfig, ModelConfig } from './config';

export interface ContextItem {
  id: string;
  type: 'file' | 'selection' | 'terminal' | 'codebase';
  name: string;
  content: string;
  path?: string;
  range?: {
    startLine: number;
    endLine: number;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  contextItems?: ContextItem[];
  isStreaming?: boolean;
  timestamp: number;
}

export interface WorkspaceFileResult {
  label: string;
  path: string;
}

export interface DetectedLocalModel {
  name: string;
  model: string;
  provider: 'ollama' | 'lmstudio';
  apiBase: string;
  size?: string;
}

export type FromWebviewMessage =
  | { type: 'ready' }
  | { type: 'sendMessage'; payload: { text: string; contextItems: ContextItem[] } }
  | { type: 'abortGeneration' }
  | { type: 'searchWorkspaceFiles'; payload: { query: string } }
  | { type: 'readFileContent'; payload: { path: string } }
  | { type: 'insertCode'; payload: { code: string } }
  | { type: 'copyToClipboard'; payload: { text: string } }
  | { type: 'openSettings' }
  | { type: 'openModelsHub' }
  | { type: 'clearChat' }
  | { type: 'getConfig' }
  | { type: 'getVscodeSettings' }
  | { type: 'updateVscodeSetting'; payload: { key: string; value: any } }
  | { type: 'saveConfig'; payload: { config: AppConfig; rawYaml?: string } }
  | { type: 'testModelConnection'; payload: { modelConfig: ModelConfig } }
  | { type: 'detectLocalModels' }
  | { type: 'openConfigFile' }
  | { type: 'readTerminalContent' }
  | { type: 'generateCommitMessage' }
  | { type: 'getTokenOptimizerConfig' }
  | { type: 'saveTokenOptimizerConfig'; payload: Record<string, unknown> }
  | { type: 'getTokenStats' }
  | { type: 'clearTokenStats' };

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
  | { type: 'testModelResult'; payload: { modelId: string; success: boolean; latencyMs?: number; error?: string } }
  | { type: 'openSettingsTab' }
  | { type: 'localModelsDetected'; payload: { models: DetectedLocalModel[] } }
  | { type: 'tokenOptimizerConfig'; payload: Record<string, unknown> }
  | { type: 'tokenStatsResult'; payload: Record<string, unknown> };
