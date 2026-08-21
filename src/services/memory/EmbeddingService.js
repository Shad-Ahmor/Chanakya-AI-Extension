"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingService = void 0;
const configManager_1 = require("../configManager");
const logger_1 = require("../../utils/logger");
class EmbeddingService {
    static instance;
    logger = logger_1.Logger.getInstance();
    configManager = configManager_1.ConfigManager.getInstance();
    constructor() { }
    static getInstance() {
        if (!EmbeddingService.instance) {
            EmbeddingService.instance = new EmbeddingService();
        }
        return EmbeddingService.instance;
    }
    async getEmbedding(text) {
        const config = this.configManager.getConfig();
        const activeModel = config.models.find(m => m.id === config.activeChatModelId) || config.models[0];
        if (!activeModel) {
            this.logger.error('No model configured for embeddings.');
            return [];
        }
        try {
            // Clean up text
            const cleanText = text.replace(/\n/g, ' ').trim();
            // OpenAI Compatible Providers (OpenAI, LM Studio, Ollama, vLLM, etc)
            if (activeModel.provider !== 'gemini' && activeModel.provider !== 'anthropic') {
                const apiBase = (activeModel.apiBase || 'https://api.openai.com/v1').replace(/\/+$/, '');
                const endpoint = `${apiBase}/embeddings`;
                const headers = {
                    'Content-Type': 'application/json'
                };
                if (activeModel.apiKey && activeModel.apiKey.trim().length > 0) {
                    headers['Authorization'] = `Bearer ${activeModel.apiKey.trim()}`;
                }
                // For local models, model name is usually ignored or uses the same name as chat.
                // For OpenAI, it requires 'text-embedding-3-small' or similar. 
                // For MVP, we'll try to use the chat model name or default to 'text-embedding-ada-002'.
                const embeddingModelName = activeModel.isLocal ? activeModel.model : 'text-embedding-3-small';
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        input: cleanText,
                        model: embeddingModelName
                    })
                });
                if (!res.ok) {
                    throw new Error(`Embedding API error: ${res.statusText}`);
                }
                const data = await res.json();
                if (data.data && data.data.length > 0 && data.data[0].embedding) {
                    return data.data[0].embedding;
                }
            }
            // Gemini
            else if (activeModel.provider === 'gemini') {
                const apiKey = activeModel.apiKey || '';
                const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'models/text-embedding-004',
                        content: { parts: [{ text: cleanText }] }
                    })
                });
                if (!res.ok) {
                    throw new Error(`Gemini Embedding API error: ${res.statusText}`);
                }
                const data = await res.json();
                if (data.embedding && data.embedding.values) {
                    return data.embedding.values;
                }
            }
            throw new Error(`Embeddings not supported natively for provider: ${activeModel.provider}.`);
        }
        catch (err) {
            this.logger.error('Failed to generate embedding', err);
            throw err;
        }
    }
}
exports.EmbeddingService = EmbeddingService;
//# sourceMappingURL=EmbeddingService.js.map