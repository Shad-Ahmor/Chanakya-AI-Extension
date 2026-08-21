"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PxPipeService = exports.DEFAULT_PXPIPE_CONFIG = void 0;
const pxpipeRenderer_1 = require("../utils/pxpipeRenderer");
const factsheetExtractor_1 = require("../utils/factsheetExtractor");
const schemaStripper_1 = require("../utils/schemaStripper");
const visionCostCalculator_1 = require("../utils/visionCostCalculator");
const pxpipeTracker_1 = require("./pxpipeTracker");
const logger_1 = require("../utils/logger");
exports.DEFAULT_PXPIPE_CONFIG = {
    enabled: true,
    minCharThreshold: 2000,
    targetModelProfile: 'auto',
    compressSystemPrompt: true,
    compressToolSchemas: true,
    compressOldHistory: true,
    stripJsonSchemaAnnotations: true,
    enablePromptPinning: true,
    keepRecentTurns: 2
};
class PxPipeService {
    static instance;
    logger = logger_1.Logger.getInstance();
    tracker = pxpipeTracker_1.PxPipeTracker.getInstance();
    constructor() { }
    static getInstance() {
        if (!PxPipeService.instance) {
            PxPipeService.instance = new PxPipeService();
        }
        return PxPipeService.instance;
    }
    /**
     * Determine if an LLM is vision-capable (accepts images in user/system messages)
     */
    isVisionCapable(modelId) {
        const m = (modelId || '').toLowerCase();
        return (m.includes('claude') ||
            m.includes('gemini') ||
            m.includes('gpt-4o') ||
            m.includes('gpt-4.5') ||
            m.includes('gpt-5') ||
            m.includes('qwen') ||
            m.includes('vision') ||
            m.includes('vl') ||
            m.includes('fable') ||
            m.includes('opus') ||
            m.includes('sonnet'));
    }
    /**
     * Structure-Aware JSON schema stripping for tools
     */
    stripToolSchemas(tools) {
        return schemaStripper_1.SchemaStripper.stripToolCollection(tools);
    }
    /**
     * Convert bulky text to PxPipe visual image block if profitable
     */
    compressText(text, title = 'CHANAKYA PXPIPE COMPRESSED CONTEXT', modelId = 'claude-3-7-sonnet', contextType = 'system_prompt') {
        if (!text || text.length < 1000) {
            return null;
        }
        try {
            const result = pxpipeRenderer_1.PxPipeRenderer.renderTextToPng(text, {
                title,
                columns: text.length > 5000 ? 2 : 1,
                showLineNumbers: true
            });
            // Calculate exact model pricing arbitrage
            const arbitrage = visionCostCalculator_1.VisionCostCalculator.calculateArbitrage(result.charCount, modelId, result.width, result.height);
            // Record telemetry event
            this.tracker.recordEvent({
                modelId,
                contextType,
                charCount: result.charCount,
                counterfactualTextTokens: arbitrage.textTokens,
                actualImageTokens: arbitrage.imageTokens,
                savedTokens: arbitrage.tokensSaved,
                savingsUsd: arbitrage.dollarsSavedUsd,
                savingsRatio: arbitrage.savingsPercentage
            });
            this.logger.log(`[PxPipe] Compressed ${result.charCount} chars (~${arbitrage.textTokens} text tokens) to ~${arbitrage.imageTokens} image tokens. Savings: ${arbitrage.savingsPercentage}% (+$${arbitrage.dollarsSavedUsd.toFixed(4)})`);
            return result;
        }
        catch (err) {
            this.logger.error('[PxPipe] Failed to compress text to image:', err);
            return null;
        }
    }
    /**
     * Format image data as standard multi-modal content parts across model providers
     */
    formatMultimodalMessage(provider, rendered, accompanyingPrompt, enablePinning = true) {
        const factsheetText = rendered.factsheet.length > 0
            ? `\n[EXACT IDENTIFIERS FACTSHEET - PRESERVED LOSSLESS]:\n${rendered.factsheet.map(f => `- ${f}`).join('\n')}\n`
            : '';
        const instruction = `The bulky context, system instructions, and tool documentation are rendered in the high-density image below (OCR readable with line numbers). Read the image directly to answer the user request.${factsheetText}\n${accompanyingPrompt || ''}`;
        if (provider === 'anthropic') {
            const textBlock = { type: 'text', text: instruction };
            const imgBlock = {
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: rendered.base64
                }
            };
            // Prompt Caching marker (Anthropic ephemeral cache)
            if (enablePinning) {
                textBlock.cache_control = { type: 'ephemeral' };
            }
            return [textBlock, imgBlock];
        }
        else if (provider === 'gemini') {
            return [
                { text: instruction },
                {
                    inlineData: {
                        mimeType: 'image/png',
                        data: rendered.base64
                    }
                }
            ];
        }
        else {
            // OpenAI / OpenRouter standard format
            return [
                { type: 'text', text: instruction },
                {
                    type: 'image_url',
                    image_url: {
                        url: rendered.dataUri,
                        detail: 'high'
                    }
                }
            ];
        }
    }
    /**
     * Export an offline PxPipe bundle (PNG image, factsheet text, prompt text, and manifest metadata)
     */
    exportOfflineBundle(text, title) {
        const render = pxpipeRenderer_1.PxPipeRenderer.renderTextToPng(text, {
            title: title || 'CHANAKYA PXPIPE OFFLINE EXPORT',
            columns: text.length > 5000 ? 2 : 1,
            showLineNumbers: true
        });
        const factsheetResult = factsheetExtractor_1.FactsheetExtractor.extract(text);
        const factsheetTxt = `# PxPipe Exact Factsheet (${factsheetResult.tokens.length} identifiers preserved)\n\n` +
            factsheetResult.tokens.map(t => `- ${t}`).join('\n');
        const promptTxt = `I have attached the dense visual context for this request rendered as high-DPI image pages. Please inspect the image using your vision encoder and follow all instructions.\n\n${factsheetTxt}`;
        const manifest = {
            version: '1.0.0',
            generator: 'Chanakya AI Enhancer PxPipe',
            timestamp: new Date().toISOString(),
            dimensions: { width: render.width, height: render.height },
            charCount: render.charCount,
            estimatedTextTokens: render.estimatedTextTokens,
            estimatedImageTokens: render.estimatedImageTokens,
            savingsPercentage: render.savingsPercentage,
            factsheetCount: factsheetResult.tokens.length
        };
        return {
            manifest,
            factsheetTxt,
            promptTxt,
            pngDataUri: render.dataUri,
            pngBase64: render.base64
        };
    }
    getTelemetry() {
        return this.tracker.getTelemetry();
    }
    getRecentLogs() {
        return this.tracker.getRecentEvents();
    }
}
exports.PxPipeService = PxPipeService;
//# sourceMappingURL=pxpipeService.js.map