import * as vscode from 'vscode';
import { ExtensionConfig } from '../types';
import { Logger } from '../utils/logger';
import { SecretManager } from './secretManager';

export interface AIServiceStreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

/**
 * AIService handles resilient, streaming communication with LLM providers.
 * Built with native fetch, token-efficient system prompts, and strict cancellation support.
 */
export class AIService {
  private static instance: AIService;
  private readonly logger = Logger.getInstance();
  private readonly secretManager = SecretManager.getInstance();

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  public getConfig(): ExtensionConfig {
    const config = vscode.workspace.getConfiguration('aiEnhancer');
    return {
      model: config.get('model', 'gemini-1.5-flash'),
      maxTokens: config.get('maxTokens', 2048),
      temperature: config.get('temperature', 0.2),
      autoContextExtraction: config.get('autoContextExtraction', true),
      systemPrompt: config.get('systemPrompt', 'You are Chanakya AI, an expert and elite coding assistant. Provide clean, efficient, and well-documented code.'),
      chatHistorySize: config.get('chat.historySize', 10),
      customHeaders: config.get('customHeaders', {}),
      apiEndpoint: config.get('apiEndpoint', 'https://api.openai.com/v1')
    };
  }

  /**
   * Streams completion from the selected AI provider.
   */
  public async streamCompletion(params: {
    prompt: string;
    systemInstruction?: string;
    callbacks: AIServiceStreamCallbacks;
    cancellationToken?: vscode.CancellationToken;
  }): Promise<void> {
    const { prompt, systemInstruction, callbacks, cancellationToken } = params;
    const config = this.getConfig();

    const apiKey = await this.secretManager.getApiKey('gemini');
    if (!apiKey) {
      callbacks.onError(
        new Error('API Key not found. Please configure your API key using the command: "Chanakya AI Agent: Configure API Key"')
      );
      return;
    }

    try {
      this.logger.log(`Initiating stream request with model: ${config.model}`);

      // Google Gemini Stream API Endpoint
      const modelName = config.model.startsWith('gemini') ? config.model : 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${apiKey}`;

      const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

      contents.push({
        role: 'user',
        parts: [{ text: prompt }]
      });

      const bodyPayload: Record<string, unknown> = {
        contents,
        generationConfig: {
          temperature: config.temperature,
          maxOutputTokens: config.maxTokens,
          topP: 0.95
        }
      };

      const finalSystemInstruction = systemInstruction || config.systemPrompt;
      if (finalSystemInstruction) {
        bodyPayload.systemInstruction = {
          parts: [{ text: finalSystemInstruction }]
        };
      }

      const controller = new AbortController();
      if (cancellationToken) {
        cancellationToken.onCancellationRequested(() => {
          this.logger.log('AI Request cancelled by user');
          controller.abort();
        });
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Error [${response.status}]: ${errText}`);
      }

      if (!response.body) {
        throw new Error('Readable stream not supported or response body is empty');
      }

      let accumulatedText = '';
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        if (cancellationToken?.isCancellationRequested) {
          break;
        }

        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) {
            continue;
          }

          const jsonStr = trimmed.substring(6);
          try {
            const data = JSON.parse(jsonStr);
            const candidates = data.candidates;
            if (candidates && candidates[0]?.content?.parts) {
              for (const part of candidates[0].content.parts) {
                if (part.text) {
                  accumulatedText += part.text;
                  callbacks.onChunk(part.text);
                }
              }
            }
          } catch {
            // Partial JSON chunks are handled in next buffer
          }
        }
      }

      callbacks.onComplete(accumulatedText);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.log('Request aborted successfully');
        return;
      }
      this.logger.error('Error during AI streaming completion', error);
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
