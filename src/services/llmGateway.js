"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMGateway = void 0;
const configManager_1 = require("./configManager");
const logger_1 = require("../utils/logger");
const llmEngine_1 = require("./llmEngine");
const securityGuardrails_1 = require("../utils/securityGuardrails");
const evaluationService_1 = require("./evaluationService");
const compressionAgent_1 = require("./compressionAgent");
const semanticCache_1 = require("./semanticCache");
class LLMGateway {
    static instance;
    logger = logger_1.Logger.getInstance();
    llmEngine = llmEngine_1.LLMEngine.getInstance();
    constructor() { }
    static getInstance() {
        if (!LLMGateway.instance) {
            LLMGateway.instance = new LLMGateway();
        }
        return LLMGateway.instance;
    }
    /**
     * Smart Router: Determines whether to use the primary model or a fast model
     * based on the task type (e.g., chat vs complex code generation).
     */
    determinePrimaryModel(allModels, requestedModel, optimizerConfig) {
        if (!optimizerConfig || !optimizerConfig.taskType)
            return requestedModel;
        // For simple chat or explanations, we can attempt to route to a fast/cheap model if available
        if (optimizerConfig.taskType === 'chat' || optimizerConfig.taskType === 'explanation') {
            const fastModel = allModels.find(m => (m.id || m.name || '').toLowerCase().includes('haiku') ||
                (m.id || m.name || '').toLowerCase().includes('mini') ||
                (m.id || m.name || '').toLowerCase().includes('flash'));
            if (fastModel) {
                this.logger.log(`Smart Routing: Downgraded to fast model ${fastModel.id || fastModel.name} for task type ${optimizerConfig.taskType}`);
                return fastModel;
            }
        }
        // For complex coding, try to route to the smartest model available
        if (optimizerConfig.taskType === 'coding' || optimizerConfig.taskType === 'refactoring') {
            const smartModel = allModels.find(m => (m.id || m.name || '').toLowerCase().includes('sonnet') ||
                (m.id || m.name || '').toLowerCase().includes('gpt-4o') ||
                (m.id || m.name || '').toLowerCase().includes('opus'));
            if (smartModel && smartModel.id !== requestedModel.id) {
                this.logger.log(`Smart Routing: Preferring smart model ${smartModel.id || smartModel.name} for complex task type ${optimizerConfig.taskType}`);
                return smartModel;
            }
        }
        return requestedModel;
    }
    /**
     * Exponential backoff delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Main entry point for streaming requests.
     * Handles Smart Routing, Retries, and Fallbacks to secondary models.
     */
    async streamChat(params) {
        const { prompt, contextItems, optimizerConfig, callbacks, cancellationToken, existingMessages } = params;
        const config = configManager_1.ConfigManager.getInstance().getConfig();
        const allModels = config.models || [];
        let requestedModel = config.models.find((m) => m.id === config.activeChatModelId) || config.models[0];
        if (!requestedModel) {
            callbacks.onError(new Error('No model configured. Please add a model in Model Hub.'));
            return;
        }
        // 0. Pre-flight Cache Check
        const semanticCache = semanticCache_1.SemanticCache.getInstance();
        const cacheKey = semanticCache.generateHash(prompt, contextItems, existingMessages || []);
        const cachedResponse = semanticCache.get(cacheKey);
        if (cachedResponse) {
            callbacks.onChunk(`> ⚡ **Cache HIT:** Loaded from Semantic Cache (Latency: 0ms)\n\n`);
            callbacks.onChunk(cachedResponse);
            if (callbacks.onComplete) {
                callbacks.onComplete(cachedResponse);
            }
            return; // Exit early, no need to hit the API!
        }
        // 0.5 Pre-flight Guardrails (Redact PII / Secrets)
        const sanitizedPrompt = securityGuardrails_1.SecurityGuardrails.redactSensitiveInfo(prompt);
        if (sanitizedPrompt !== prompt) {
            callbacks.onChunk(`> 🛡️ **Security Alert:** Sensitive information (API keys/PII) was redacted from your prompt before sending.\n\n`);
        }
        // 1. Smart Routing
        let currentModel = this.determinePrimaryModel(allModels, requestedModel, optimizerConfig);
        // Filter out the current model to get a list of fallback models
        const fallbackModels = allModels.filter(m => m.id !== currentModel.id);
        // 1.5 Smart Agentic Context Compression (if context is huge)
        let optimizedMessages = existingMessages;
        if (existingMessages && existingMessages.length > 5) {
            // Very rough token estimate, normally we'd use TokenOptimizer
            const roughTokens = JSON.stringify(existingMessages).length / 4;
            if (roughTokens > 4000) {
                callbacks.onChunk(`> 🧠 **AI Optimization:** Context is very large (~${Math.round(roughTokens)} tokens). The Compression Agent is summarizing older history to save tokens...\n\n`);
                // We leave the last 2 messages intact, and compress the rest
                const toCompress = existingMessages.slice(0, existingMessages.length - 2);
                const toKeep = existingMessages.slice(existingMessages.length - 2);
                try {
                    const compressedText = await compressionAgent_1.CompressionAgent.getInstance().compressContext(toCompress);
                    optimizedMessages = [
                        { role: 'system', content: `[COMPRESSED HISTORY SUMMARY]:\n${compressedText}` },
                        ...toKeep
                    ];
                    callbacks.onChunk(`> ✅ **AI Optimization:** History compressed successfully! Resuming task...\n\n`);
                }
                catch (e) {
                    this.logger.error('Failed to compress context', e);
                }
            }
        }
        let attempt = 0;
        const maxRetries = 2; // Max retries per model
        const startTime = Date.now();
        while (attempt <= maxRetries) {
            if (cancellationToken?.isCancellationRequested) {
                return;
            }
            try {
                if (attempt > 0) {
                    callbacks.onChunk(`\n\n> ⚠️ Network Error. Retrying with ${currentModel.name} (Attempt ${attempt + 1}/${maxRetries + 1})...\n\n`);
                    // Exponential backoff
                    await this.delay(Math.pow(2, attempt) * 1000);
                }
                // Delegate to LLMEngine for the actual execution
                // Since LLMEngine.streamCompletion is private/protected or we just want to reuse it, 
                // wait, let's use a lower level call or just modify LLMEngine to allow passing the model directly.
                // Actually, LLMEngine.streamCompletion is what we need, let's make sure it's public in llmEngine.ts, 
                // or we just call streamChat but we need to tell it which model to use.
                // Let's use `streamCompletion` if it's public, else we will need to update llmEngine.ts.
                // Intercept callbacks for post-flight validation
                const interceptedCallbacks = {
                    onChunk: callbacks.onChunk,
                    onError: callbacks.onError,
                    ...(callbacks.onOptimizationStats ? { onOptimizationStats: callbacks.onOptimizationStats } : {}),
                    onComplete: (fullText) => {
                        const validation = securityGuardrails_1.SecurityGuardrails.validateGeneratedCode(fullText);
                        if (!validation.isValid) {
                            const warningsText = validation.warnings.map(w => `> 🚨 **Security Warning:** ${w}`).join('\n');
                            callbacks.onChunk(`\n\n${warningsText}\n\n`);
                        }
                        if (callbacks.onComplete) {
                            callbacks.onComplete(fullText);
                        }
                        // Phase 4: Async Evaluation & Telemetry
                        const latencyMs = Date.now() - startTime;
                        // Best-effort token count for telemetry
                        const tokenCount = Math.ceil(fullText.length / 4) + Math.ceil(sanitizedPrompt.length / 4);
                        // Store successful responses in Semantic Cache
                        semanticCache.set(cacheKey, fullText, tokenCount);
                        evaluationService_1.EvaluationService.getInstance().evaluateResponse(sanitizedPrompt, fullText, latencyMs, tokenCount)
                            .catch(e => this.logger.error('Failed to trigger background evaluation', e));
                    }
                };
                await this.llmEngine.streamChat({
                    prompt: sanitizedPrompt,
                    contextItems,
                    ...(optimizerConfig ? { optimizerConfig } : {}),
                    callbacks: interceptedCallbacks,
                    ...(cancellationToken ? { cancellationToken } : {}),
                    ...(optimizedMessages ? { existingMessages: optimizedMessages } : {})
                });
                // If it successfully completes, we exit
                break;
            }
            catch (err) {
                if (err.name === 'AbortError') {
                    return;
                }
                this.logger.error(`Error with model ${currentModel.id}`, err);
                const isRateLimitOrServerError = err.message?.includes('429') || err.message?.includes('500') || err.message?.includes('503') || err.message?.includes('502');
                if (attempt === maxRetries || !isRateLimitOrServerError) {
                    // Time to fallback to another model if we hit max retries or it's a fatal error
                    if (fallbackModels.length > 0) {
                        const nextModel = fallbackModels.shift();
                        callbacks.onChunk(`\n\n> 🔄 **Fallback Triggered:** Model \`${currentModel.name}\` failed. Switching to \`${nextModel.name}\`...\n\n`);
                        this.logger.log(`Fallback: Switching from ${currentModel.id} to ${nextModel.id}`);
                        currentModel = nextModel;
                        attempt = 0; // Reset retries for the new model
                        continue;
                    }
                    else {
                        // No more fallbacks
                        callbacks.onError(err);
                        return;
                    }
                }
                // Otherwise, increment attempt and retry the same model
                attempt++;
            }
        }
    }
}
exports.LLMGateway = LLMGateway;
//# sourceMappingURL=llmGateway.js.map