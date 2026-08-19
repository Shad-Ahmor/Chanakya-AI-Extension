import * as vscode from 'vscode';
import { ModelConfig } from '../types/config';
import { ContextItem } from '../types/ipc';
import { ConfigManager } from './configManager';
import { Logger } from '../utils/logger';

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
  onTokensUsed?: (modelId: string, promptTokens: number, completionTokens: number, durationMs?: number, ttftMs?: number, isError?: boolean) => void;
}

/** Simple token estimator: ~4 chars per token (GPT-family heuristic) */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * LLMEngine manages multi-provider streaming chat completions, token budgeting,
 * custom headers (workspace-id), and cancellation tokens.
 */
export class LLMEngine {
  private static instance: LLMEngine;
  private readonly logger = Logger.getInstance();
  private readonly configManager = ConfigManager.getInstance();

  public static getInstance(): LLMEngine {
    if (!LLMEngine.instance) {
      LLMEngine.instance = new LLMEngine();
    }
    return LLMEngine.instance;
  }

  /**
   * Streams chat completion for the active configured model.
   */
  public async streamChat(params: {
    prompt: string;
    contextItems: ContextItem[];
    callbacks: StreamCallbacks;
    cancellationToken?: vscode.CancellationToken;
  }): Promise<void> {
    const { prompt, contextItems, callbacks, cancellationToken } = params;
    const config = this.configManager.getConfig();
    const activeModel =
      config.models.find((m) => m.id === config.activeChatModelId) || config.models[0];

    if (!activeModel) {
      callbacks.onError(new Error('No model configured. Please add a model in Model Hub.'));
      return;
    }

    this.logger.log(`Starting stream completion with model "${activeModel.name}" (${activeModel.model})`);

    const abortController = new AbortController();
    if (cancellationToken) {
      cancellationToken.onCancellationRequested(() => {
        this.logger.log('Streaming aborted by user request.');
        abortController.abort();
      });
    }

    const startTime = Date.now();
    let firstChunkTime: number | null = null;
    let isError = false;

    const wrappedCallbacks: StreamCallbacks = {
      onChunk: (chunk) => {
        if (!firstChunkTime) firstChunkTime = Date.now();
        callbacks.onChunk(chunk);
      },
      onComplete: (fullText) => {
        callbacks.onComplete(fullText);
      },
      onError: (error) => {
        isError = true;
        callbacks.onError(error);
      },
      onTokensUsed: (modelId, promptTokens, completionTokens) => {
        const endTime = Date.now();
        const durationMs = (endTime - startTime) / 1000;
        const ttftMs = firstChunkTime ? (firstChunkTime - startTime) / 1000 : durationMs;
        
        if (callbacks.onTokensUsed) {
          callbacks.onTokensUsed(modelId, promptTokens, completionTokens, durationMs, ttftMs, isError);
        }
      }
    };

    try {
      if (activeModel.provider === 'gemini' && !activeModel.apiBase?.includes('/v1')) {
        await this.streamGemini(activeModel, prompt, contextItems, wrappedCallbacks, abortController.signal);
      } else {
        // OpenAI-compatible / Ollama / LM Studio / Enterprise AI Foundry
        await this.streamOpenAICompatible(activeModel, prompt, contextItems, wrappedCallbacks, abortController.signal);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        this.logger.log('Request aborted successfully.');
        return;
      }
      isError = true;
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error('Error during LLM streaming completion', error);
      wrappedCallbacks.onError(error);
      
      // If error happens before tokens are counted, we might still want to log an error request.
      // Usually the provider might not call onTokensUsed if it fails early. 
      // We can manually trigger it here if it hasn't been triggered. (Simplified for now).
    }
  }

  /**
   * OpenAI / Ollama / Enterprise AI Foundry stream completions handler.
   */
  private async streamOpenAICompatible(
    model: ModelConfig,
    prompt: string,
    contextItems: ContextItem[],
    callbacks: StreamCallbacks,
    signal: AbortSignal
  ): Promise<void> {
    const apiBase = (model.apiBase || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const endpoint = `${apiBase}/chat/completions`;

    // Construct system and user prompt with context items
    const systemContent =
      'You are an expert AI software engineer and code assistant for VS Code. ' +
      'Provide clear, concise, accurate, and production-ready code. ' +
      'Format all code snippets with correct markdown syntax highlighting.';

    let formattedUserPrompt = '';

    // Inject Context Items (Selections and Files)
    if (contextItems.length > 0) {
      formattedUserPrompt += '--- Context Items Attached ---\n\n';
      for (const item of contextItems) {
        if (item.type === 'selection') {
          formattedUserPrompt += `[Code Selection: ${item.name}]\n\`\`\`\n${item.content}\n\`\`\`\n\n`;
        } else if (item.type === 'file') {
          formattedUserPrompt += `[File Reference: ${item.name} (${item.path || ''})]\n\`\`\`\n${item.content}\n\`\`\`\n\n`;
        }
      }
      formattedUserPrompt += '--- End of Context ---\n\n';
    }

    formattedUserPrompt += prompt;

    const messages = [
      { role: 'system', content: systemContent },
      { role: 'user', content: formattedUserPrompt }
    ];

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(model.requestOptions?.headers || {})
    };

    if (model.apiKey && model.apiKey.trim().length > 0) {
      headers['Authorization'] = `Bearer ${model.apiKey.trim()}`;
    }

    const payload: Record<string, unknown> = {
      model: model.model,
      messages,
      stream: true,
      temperature: model.defaultCompletionOptions?.temperature ?? 0.2,
      max_tokens: model.defaultCompletionOptions?.maxTokens ?? 4096,
      ...(model.requestOptions?.extraBody || {})
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`LLM API Error [${res.status}]: ${errBody}`);
    }

    if (!res.body) {
      throw new Error('Readable stream not supported or response body is empty');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.substring(6));
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            callbacks.onChunk(delta);
          }
        } catch {
          // Incomplete chunk handled in next read
        }
      }
    }

    callbacks.onComplete(fullText);

    // Token usage tracking
    if (callbacks.onTokensUsed) {
      const promptText = messages.map((m) => m.content).join(' ');
      const promptTokens = estimateTokens(promptText);
      const completionTokens = estimateTokens(fullText);
      const modelId = model.id || model.name;
      callbacks.onTokensUsed(modelId, promptTokens, completionTokens);
    }
  }

  /**
   * Google Gemini Native API Streaming handler.
   */
  private async streamGemini(
    model: ModelConfig,
    prompt: string,
    contextItems: ContextItem[],
    callbacks: StreamCallbacks,
    signal: AbortSignal
  ): Promise<void> {
    const apiKey = model.apiKey || '';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    let fullPrompt = '';
    if (contextItems.length > 0) {
      for (const item of contextItems) {
        fullPrompt += `[Context: ${item.name}]\n${item.content}\n\n`;
      }
    }
    fullPrompt += prompt;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature: model.defaultCompletionOptions?.temperature ?? 0.2,
          maxOutputTokens: model.defaultCompletionOptions?.maxTokens ?? 4096
        }
      }),
      signal
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API Error [${res.status}]: ${err}`);
    }

    if (!res.body) throw new Error('Response body empty');

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        try {
          const json = JSON.parse(trimmed.substring(6));
          const partText = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (partText) {
            fullText += partText;
            callbacks.onChunk(partText);
          }
        } catch {
          // Next buffer
        }
      }
    }

    callbacks.onComplete(fullText);

    // Token usage tracking
    if (callbacks.onTokensUsed) {
      const promptText = fullPrompt;
      const promptTokens = estimateTokens(promptText);
      const completionTokens = estimateTokens(fullText);
      const modelId = model.id || model.name;
      callbacks.onTokensUsed(modelId, promptTokens, completionTokens);
    }
  }
}
