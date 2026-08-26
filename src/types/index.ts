/**
 * Core type definitions for Chanakya AI Agent
 */

export type AIModelType =
  | 'gemini-1.5-flash'
  | 'gemini-1.5-pro'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'claude-3-5-sonnet'
  | 'custom';

export type AIActionType = 'enhance' | 'explain' | 'refactor' | 'chat' | 'fix' | 'docstring';

export interface CodeContext {
  readonly languageId: string;
  readonly fileName: string;
  readonly selectedCode: string;
  readonly surroundingContext?: string | undefined;
  readonly cursorPosition?: {
    readonly line: number;
    readonly character: number;
  } | undefined;
  readonly totalLines: number;
}

export interface ChatMessage {
  readonly id: string;
  readonly sender: 'user' | 'assistant' | 'system';
  readonly text: string;
  readonly timestamp: number;
  readonly action?: AIActionType | undefined;
  readonly codeContext?: Partial<CodeContext> | undefined;
  readonly isStreaming?: boolean | undefined;
}

export interface ExtensionConfig {
  readonly model: AIModelType | string;
  readonly maxTokens: number;
  readonly temperature: number;
  readonly autoContextExtraction: boolean;
  readonly systemPrompt: string;
  readonly chatHistorySize: number;
  readonly customHeaders: Record<string, string>;
  readonly apiEndpoint: string;
}

/**
 * IPC message contracts between Webview and Extension Host
 */
export type WebviewToExtensionMessage =
  | { type: 'ready' }
  | { type: 'sendMessage'; payload: { text: string; action?: AIActionType | undefined; includeSelection?: boolean | undefined } }
  | { type: 'setApiKey'; payload: { provider: string; apiKey: string } }
  | { type: 'getApiKeyStatus' }
  | { type: 'clearHistory' }
  | { type: 'insertCode'; payload: { code: string } }
  | { type: 'applyCodeMerge'; payload: { code: string } }
  | { type: 'copyToClipboard'; payload: { text: string } }
  | { type: 'openSettings' };

export type ExtensionToWebviewMessage =
  | { type: 'addMessage'; payload: ChatMessage }
  | { type: 'streamChunk'; payload: { id: string; chunk: string } }
  | { type: 'streamEnd'; payload: { id: string } }
  | { type: 'setApiKeyStatus'; payload: { hasKey: boolean; provider: string } }
  | { type: 'clearChat' }
  | { type: 'setError'; payload: { message: string } }
  | { type: 'setLoading'; payload: { isLoading: boolean } }
  | { type: 'updateContext'; payload: { activeFile?: string | undefined; selectedCodeSnippet?: string | undefined } };

