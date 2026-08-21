import { AppConfig, ModelConfig } from './config';
import { GraphifyData } from './graphify';

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
  readonly role: 'user' | 'assistant' | 'system' | 'tool';
  readonly content: string;
  readonly contextItems?: ContextItem[] | undefined;
  readonly isStreaming?: boolean | undefined;
  readonly timestamp: number;
  readonly taskStatuses?: TaskStatus[] | undefined;
  readonly optimizationStats?: {
    readonly originalTokens: number;
    readonly optimizedTokens: number;
  } | undefined;
  readonly tool_calls?: any[] | undefined;
  readonly tool_call_id?: string | undefined;
  readonly name?: string | undefined;
  readonly artifacts?: { readonly name: string; readonly content: string }[] | undefined;
  readonly fileChanges?: {
    readonly count: number;
    readonly added: number;
    readonly deleted: number;
    readonly modified: number;
  } | undefined;
  readonly thought?: string | undefined;
  readonly thoughtDurationMs?: number | undefined;
  readonly isThinking?: boolean | undefined;
  readonly planState?: any | undefined;
  readonly telemetry?: {
    readonly durationSec?: number | undefined;
    readonly ttftSec?: number | undefined;
    readonly tokensPerSec?: number | undefined;
    readonly promptTokens?: number | undefined;
    readonly completionTokens?: number | undefined;
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
  | { type: 'executeToolManual'; payload: { toolName: string; argsString: string } }
  | { type: 'submitUserOption'; payload: { choice: string } }
  | { type: 'streamFileEdit'; payload: { path: string; code: string; isStreaming: boolean } }
  | { type: 'copyToClipboard'; payload: { text: string } }
  | { type: 'openSettings' }
  | { type: 'openModelsHub' }
  | { type: 'clearChat' }
  | { type: 'getConfig' }
  | { type: 'getVscodeSettings' }
  | { type: 'setPxpipeSetting'; payload: { key: string; value: any } }
  | { type: 'skillOps:getSkills' }
  | { type: 'skillOps:getSkillHistory'; payload: { skillName: string } }
  | { type: 'skillOps:runOptimization'; payload: { skillName: string } }
  | { type: 'skillOps:rollbackSkill'; payload: { skillName: string; version: number } }
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
  | { type: 'openFilePicker' }
  | { type: 'showInformationMessage'; payload: { message: string } }
  | { type: 'submitProceed' }
  | { type: 'openSourceControl' }
  | { type: 'getGraphifyData'; payload?: { refresh?: boolean } }
  | { type: 'openFileInEditor'; payload: { filePath: string } }
  | { type: 'openFile'; payload: { filePath: string } }
  | { type: 'calculateBlastRadius'; payload: { nodeId: string } }
  | { type: 'answerUserPrompt'; payload: { id: string; answer: string } }
  | { type: 'setTaskStatus'; payload: { taskId: string; status: 'pending' | 'in_progress' | 'completed' | 'failed' } }
  | { type: 'exportArchitectureMd' }
  | { type: 'getMcpHubData' }
  | { type: 'addMcpServer'; payload: { name: string; config: any } }
  | { type: 'removeMcpServer'; payload: { name: string } }
  | { type: 'toggleMcpServer'; payload: { name: string; enabled: boolean } }
  | { type: 'pingMcpServer'; payload: { name: string } }
  | { type: 'testMcpTool'; payload: { serverName: string; toolName: string; args: Record<string, any> } }
  | { type: 'renderPxPipePreview'; payload: { text: string; title?: string } }
  | { type: 'getPxPipeTelemetry' };

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
  | { type: 'pxpipeSettingsUpdated'; payload: { settings: any } }
  | { type: 'skillOps:skillsResult'; payload: { skills: any[] } }
  | { type: 'skillOps:historyResult'; payload: { skillName: string; history: any[] } }
  | { type: 'skillOps:optimizationResult'; payload: { result: any; error?: string } }
  | { type: 'skillOps:rollbackResult'; payload: { success: boolean; error?: string } }
  | { type: 'testModelResult'; payload: { modelId: string; success: boolean; latencyMs?: number | undefined; error?: string | undefined } }
  | { type: 'updateTaskStatus'; payload: { messageId: string; task: TaskStatus } }
  | { type: 'openSettingsTab' }
  | { type: 'localModelsDetected'; payload: { models: DetectedLocalModel[] } }
  | { type: 'optimizationStats'; payload: { messageId: string; originalTokens: number; optimizedTokens: number; evaluationScore?: number } }
  | { type: 'tokenStatsResult'; payload: Record<string, unknown> }
  | { type: 'tokenOptimizerConfig'; payload: Record<string, unknown> }
  | { type: 'conversationsLoaded'; payload: { conversations: Conversation[]; activeId: string | null } }
  | { type: 'activeConversationChanged'; payload: { conversation: Conversation } }
  | { type: 'fileAttached'; payload: { name: string; path: string; content: string } }
  | { type: 'artifactUpdated'; payload: { name: string; content: string } }
  | { type: 'fileChanged'; payload: { path: string; changeType: 'create' | 'modify' | 'delete' } }
  | { type: 'graphifyDataResult'; payload: { data: GraphifyData } }
  | { type: 'blastRadiusResult'; payload: { result: any } }
  | { type: 'openGraphifyView' }
  | { type: 'mcpHubDataResult'; payload: { servers: any[]; logs: any[] } }
  | { type: 'mcpToolTestResult'; payload: { toolName: string; result?: string; error?: string; latencyMs: number } }
  | { type: 'pxpipePreviewResult'; payload: { dataUri: string; width: number; height: number; charCount: number; textTokens: number; imageTokens: number; savingsPercentage: number; factsheet: string[] } }
  | { type: 'pxpipeTelemetryResult'; payload: { telemetry: any; recentLogs: any[] } }
  | { type: 'streamThoughtChunk'; payload: { messageId: string; chunk: string } }
  | { type: 'thoughtComplete'; payload: { messageId: string; thought: string; durationMs: number } }
  | { type: 'planUpdated'; payload: { plan: any | null } }
  | { type: 'askUserPrompt'; payload: { id: string; question: string; options?: string[]; defaultOption?: string; isMultiSelect?: boolean } };
