import * as vscode from 'vscode';
import { ModelConfig } from '../types/config';
import { ConfigManager } from './configManager';
import { SecretManager } from './secretManager';
import { Logger } from '../utils/logger';

/**
 * FIMService executes high-speed Fill-In-The-Middle inline completions
 * supporting Qwen2.5-Coder, Codestral, DeepSeek, Ollama, and OpenAI-compatible FIM endpoints.
 */
export class FIMService {
  private static instance: FIMService;
  private readonly logger = Logger.getInstance();
  private readonly configManager = ConfigManager.getInstance();

  public static getInstance(): FIMService {
    if (!FIMService.instance) {
      FIMService.instance = new FIMService();
    }
    return FIMService.instance;
  }

  /**
   * Generates inline FIM autocomplete suggestion.
   */
  public async getFIMCompletion(params: {
    prefix: string;
    suffix: string;
    languageId: string;
    token: vscode.CancellationToken;
  }): Promise<string | null> {
    const { prefix, suffix, token } = params;
    const config = this.configManager.getConfig();

    // Find active Autocomplete/FIM model, fallback to active chat model
    const fimModelId = config.activeAutocompleteModelId || config.activeChatModelId;
    const model = config.models.find((m) => m.id === fimModelId) || config.models[0];

    if (!model) {
      return null;
    }

    const abortController = new AbortController();
    token.onCancellationRequested(() => {
      abortController.abort();
    });

    try {
      if (model.provider === 'ollama') {
        return await this.fetchOllamaFIM(model, prefix, suffix, abortController.signal);
      } else {
        return await this.fetchOpenAICompatibleFIM(model, prefix, suffix, abortController.signal);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Normal cancellation while typing
        return null;
      }
      this.logger.warn(`FIM Autocomplete failed for model ${model.name}`, err);
      return null;
    }
  }

  /**
   * Ollama Native FIM handler (/api/generate with prompt & suffix).
   */
  private async fetchOllamaFIM(
    model: ModelConfig,
    prefix: string,
    suffix: string,
    signal: AbortSignal
  ): Promise<string | null> {
    const apiBase = (model.apiBase || 'http://localhost:11434').replace(/\/+$/, '').replace(/\/v1$/, '');
    const url = `${apiBase}/api/generate`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model.model,
        prompt: prefix,
        suffix: suffix,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 64,
          stop: ['\n\n', '<|file_separator|>', '<|endoftext|>', '<|fim_prefix|>']
        }
      }),
      signal
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { response?: string };
    return data.response ? data.response.replace(/\r\n/g, '\n') : null;
  }

  /**
   * OpenAI / AI Foundry / Codestral / Qwen / DeepSeek FIM handler.
   */
  private async fetchOpenAICompatibleFIM(
    model: ModelConfig,
    prefix: string,
    suffix: string,
    signal: AbortSignal
  ): Promise<string | null> {
    const apiBase = (model.apiBase || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(model.requestOptions?.headers || {})
    };

    const apiKey = await SecretManager.getInstance().getApiKey(model.provider);
    if (apiKey && apiKey.trim().length > 0) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }

    // Check if endpoint supports /v1/completions for FIM
    const completionsEndpoint = `${apiBase}/completions`;
    
    // Construct standard Qwen / DeepSeek FIM prompt tokens if using chat/completion
    const fimPrompt = `<|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`;

    try {
      const res = await fetch(completionsEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: model.model,
          prompt: fimPrompt,
          max_tokens: 64,
          temperature: 0.1,
          stream: false,
          stop: ['\n\n', '<|file_separator|>', '<|endoftext|>', '<|fim_prefix|>', '<|fim_suffix|>']
        }),
        signal
      });

      if (res.ok) {
        const data = (await res.json()) as { choices?: Array<{ text?: string }> };
        const text = data.choices?.[0]?.text;
        if (text && text.length > 0) {
          return text;
        }
      }
    } catch {
      // Fallback to chat completions if /completions is not supported
    }

    // Fallback: Chat completion single-turn prompt
    const chatEndpoint = `${apiBase}/chat/completions`;
    const chatRes = await fetch(chatEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model.model,
        messages: [
          {
            role: 'system',
            content: 'You are a code completion assistant. Output ONLY the code to insert at the cursor. No markdown, no explanations.'
          },
          {
            role: 'user',
            content: `Prefix code:\n\`\`\`\n${prefix}\n\`\`\`\nSuffix code:\n\`\`\`\n${suffix}\n\`\`\`\nComplete the code in the middle:`
          }
        ],
        max_tokens: 64,
        temperature: 0.1,
        stream: false
      }),
      signal
    });

    if (chatRes.ok) {
      const data = (await chatRes.json()) as { choices?: Array<{ message?: { content?: string } }> };
      let text = data.choices?.[0]?.message?.content || '';
      // Strip markdown code fences if model returned them
      text = text.replace(/^```[a-zA-Z0-9_-]*\n/, '').replace(/\n```$/, '');
      return text.length > 0 ? text : null;
    }

    return null;
  }
}
