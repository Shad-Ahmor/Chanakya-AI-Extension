"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompressionAgent = void 0;
const llmEngine_1 = require("./llmEngine");
const configManager_1 = require("./configManager");
const logger_1 = require("../utils/logger");
class CompressionAgent {
    static instance;
    logger = logger_1.Logger.getInstance();
    llmEngine = llmEngine_1.LLMEngine.getInstance();
    constructor() { }
    static getInstance() {
        if (!CompressionAgent.instance) {
            CompressionAgent.instance = new CompressionAgent();
        }
        return CompressionAgent.instance;
    }
    /**
     * Intelligently summarizes a large conversation history or codebase chunk into a dense, token-optimized string.
     */
    async compressContext(messages, maxTokensOutput = 2000) {
        this.logger.log(`[CompressionAgent] Starting compression for ${messages.length} messages.`);
        const config = configManager_1.ConfigManager.getInstance().getConfig();
        const allModels = config.models || [];
        // Prefer a fast and cheap model for compression (like haiku or mini)
        const compressModel = allModels.find(m => (m.id || m.name || '').toLowerCase().includes('haiku') || (m.id || m.name || '').toLowerCase().includes('mini')) || allModels[0];
        if (!compressModel) {
            this.logger.warn('[CompressionAgent] No model available for compression, falling back to raw JSON serialization.');
            return JSON.stringify(messages);
        }
        // Convert messages to a readable format for the LLM
        const rawText = messages.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n\n');
        const prompt = `
You are a Pro-Grade Token Compression Agent.
Your task is to take the following chat history and summarize it into a dense, token-efficient, technical state representation.
Do not lose any critical technical constraints, code snippets (if absolutely necessary), or the user's current goal.
Eliminate all conversational fluff, pleasantries, and redundant code.
The summary MUST be highly compressed, prioritizing facts, variables, functions mentioned, and the exact next step.

[RAW HISTORY START]
${rawText}
[RAW HISTORY END]

Provide ONLY the dense technical summary. No introductory text.
    `;
        let compressedText = '';
        try {
            // Stream but accumulate internally
            await this.llmEngine.streamChat({
                prompt,
                contextItems: [],
                optimizerConfig: { responseConciseness: 'ultra_concise' },
                callbacks: {
                    onChunk: (chunk) => { compressedText += chunk; },
                    onComplete: () => { },
                    onError: (err) => { this.logger.error('Compression failed', err); }
                }
            });
            this.logger.log(`[CompressionAgent] Successfully compressed context. Length: ${compressedText.length}`);
            return compressedText.trim();
        }
        catch (err) {
            this.logger.error('[CompressionAgent] Error during compression, returning fallback raw text.', err);
            // Fallback
            return rawText.slice(0, maxTokensOutput * 4); // rough character fallback
        }
    }
}
exports.CompressionAgent = CompressionAgent;
//# sourceMappingURL=compressionAgent.js.map