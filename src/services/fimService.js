"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FIMService = void 0;
const configManager_1 = require("./configManager");
const logger_1 = require("../utils/logger");
/**
 * FIMService executes high-speed Fill-In-The-Middle inline completions
 * supporting Qwen2.5-Coder, Codestral, DeepSeek, Ollama, and OpenAI-compatible FIM endpoints.
 */
class FIMService {
    static instance;
    logger = logger_1.Logger.getInstance();
    configManager = configManager_1.ConfigManager.getInstance();
    static getInstance() {
        if (!FIMService.instance) {
            FIMService.instance = new FIMService();
        }
        return FIMService.instance;
    }
    /**
     * Generates inline FIM autocomplete suggestion.
     */
    async getFIMCompletion(params) {
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
            }
            else {
                return await this.fetchOpenAICompatibleFIM(model, prefix, suffix, abortController.signal);
            }
        }
        catch (err) {
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
    async fetchOllamaFIM(model, prefix, suffix, signal) {
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
        if (!res.ok)
            return null;
        const data = (await res.json());
        return data.response ? data.response.replace(/\r\n/g, '\n') : null;
    }
    /**
     * OpenAI / AI Foundry / Codestral / Qwen / DeepSeek FIM handler.
     */
    async fetchOpenAICompatibleFIM(model, prefix, suffix, signal) {
        const apiBase = (model.apiBase || 'https://api.openai.com/v1').replace(/\/+$/, '');
        const headers = {
            'Content-Type': 'application/json',
            ...(model.requestOptions?.headers || {})
        };
        if (model.apiKey && model.apiKey.trim().length > 0) {
            headers['Authorization'] = `Bearer ${model.apiKey.trim()}`;
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
                const data = (await res.json());
                const text = data.choices?.[0]?.text;
                if (text && text.length > 0) {
                    return text;
                }
            }
        }
        catch {
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
            const data = (await chatRes.json());
            let text = data.choices?.[0]?.message?.content || '';
            // Strip markdown code fences if model returned them
            text = text.replace(/^```[a-zA-Z0-9_-]*\n/, '').replace(/\n```$/, '');
            return text.length > 0 ? text : null;
        }
        return null;
    }
}
exports.FIMService = FIMService;
//# sourceMappingURL=fimService.js.map