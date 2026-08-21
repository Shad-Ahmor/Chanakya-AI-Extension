"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
const secretManager_1 = require("./secretManager");
/**
 * AIService handles resilient, streaming communication with LLM providers.
 * Built with native fetch, token-efficient system prompts, and strict cancellation support.
 */
class AIService {
    static instance;
    logger = logger_1.Logger.getInstance();
    secretManager = secretManager_1.SecretManager.getInstance();
    static getInstance() {
        if (!AIService.instance) {
            AIService.instance = new AIService();
        }
        return AIService.instance;
    }
    getConfig() {
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
    async streamCompletion(params) {
        const { prompt, systemInstruction, callbacks, cancellationToken } = params;
        const config = this.getConfig();
        const apiKey = await this.secretManager.getApiKey('gemini');
        if (!apiKey) {
            callbacks.onError(new Error('API Key not found. Please configure your API key using the command: "Chanakya AI Enhancer: Configure API Key"'));
            return;
        }
        try {
            this.logger.log(`Initiating stream request with model: ${config.model}`);
            // Google Gemini Stream API Endpoint
            const modelName = config.model.startsWith('gemini') ? config.model : 'gemini-1.5-flash';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${apiKey}`;
            const contents = [];
            contents.push({
                role: 'user',
                parts: [{ text: prompt }]
            });
            const bodyPayload = {
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
                    }
                    catch {
                        // Partial JSON chunks are handled in next buffer
                    }
                }
            }
            callbacks.onComplete(accumulatedText);
        }
        catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                this.logger.log('Request aborted successfully');
                return;
            }
            this.logger.error('Error during AI streaming completion', error);
            callbacks.onError(error instanceof Error ? error : new Error(String(error)));
        }
    }
}
exports.AIService = AIService;
//# sourceMappingURL=aiService.js.map