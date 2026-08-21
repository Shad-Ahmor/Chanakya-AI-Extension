"use strict";
/**
 * Multi-Model Vision Token & Pricing Arbitrage Calculator
 * Based on PxPipe's vision-cost.ts and model profiles.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisionCostCalculator = exports.VISION_MODEL_PROFILES = void 0;
exports.VISION_MODEL_PROFILES = {
    'claude-3-7-sonnet': {
        name: 'Claude 3.7 Sonnet',
        provider: 'anthropic',
        textInputPricePerMillion: 3.0,
        textTokensPerChar: 0.38,
        tileDimensions: { width: 1568, height: 728 },
        imageTileTokens: (w, h) => Math.ceil((w * h) / 750) // ~1,600 tokens standard tile
    },
    'claude-3-5-sonnet': {
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        textInputPricePerMillion: 3.0,
        textTokensPerChar: 0.38,
        tileDimensions: { width: 1568, height: 728 },
        imageTileTokens: (w, h) => Math.ceil((w * h) / 750)
    },
    'claude-3-opus': {
        name: 'Claude 3 Opus',
        provider: 'anthropic',
        textInputPricePerMillion: 15.0,
        textTokensPerChar: 0.38,
        tileDimensions: { width: 1568, height: 728 },
        imageTileTokens: (w, h) => Math.ceil((w * h) / 750)
    },
    'gemini-2.0-flash': {
        name: 'Gemini 2.0 Flash',
        provider: 'google',
        textInputPricePerMillion: 0.10,
        textTokensPerChar: 0.35,
        tileDimensions: { width: 768, height: 768 },
        imageTileTokens: () => 258 // Google charges fixed 258 tokens per standard image tile
    },
    'gemini-1.5-pro': {
        name: 'Gemini 1.5 Pro',
        provider: 'google',
        textInputPricePerMillion: 1.25,
        textTokensPerChar: 0.35,
        tileDimensions: { width: 768, height: 768 },
        imageTileTokens: () => 258
    },
    'gpt-4o': {
        name: 'GPT-4o',
        provider: 'openai',
        textInputPricePerMillion: 2.50,
        textTokensPerChar: 0.36,
        tileDimensions: { width: 1024, height: 1024 },
        imageTileTokens: (w, h) => {
            // 85 base tokens + 170 per 512x512 tile
            const tilesX = Math.ceil(w / 512);
            const tilesY = Math.ceil(h / 512);
            return 85 + (tilesX * tilesY * 170); // ~765 tokens for 2x2
        }
    },
    'qwen2.5-vl': {
        name: 'Qwen 2.5 VL',
        provider: 'other',
        textInputPricePerMillion: 0.40,
        textTokensPerChar: 0.35,
        tileDimensions: { width: 1024, height: 1024 },
        imageTileTokens: (w, h) => Math.ceil((w * h) / (28 * 28))
    }
};
class VisionCostCalculator {
    /**
     * Calculate detailed cost and token comparison between raw text and PxPipe image
     */
    static calculateArbitrage(charCount, modelId = 'claude-3-7-sonnet', imageWidth = 1568, imageHeight = 800) {
        const profileKey = Object.keys(exports.VISION_MODEL_PROFILES).find((k) => modelId.toLowerCase().includes(k)) || 'claude-3-7-sonnet';
        const profile = exports.VISION_MODEL_PROFILES[profileKey];
        const textTokens = Math.ceil(charCount * profile.textTokensPerChar);
        const textCostUsd = (textTokens / 1_000_000) * profile.textInputPricePerMillion;
        const imageTokens = profile.imageTileTokens(imageWidth, imageHeight);
        const imageCostUsd = (imageTokens / 1_000_000) * profile.textInputPricePerMillion;
        const tokensSaved = Math.max(0, textTokens - imageTokens);
        const dollarsSavedUsd = Math.max(0, textCostUsd - imageCostUsd);
        const savingsPercentage = textTokens > 0 ? Math.round((tokensSaved / textTokens) * 100) : 0;
        const isProfitable = textTokens > imageTokens;
        return {
            modelName: profile.name,
            textTokens,
            textCostUsd,
            imageTokens,
            imageCostUsd,
            tokensSaved,
            dollarsSavedUsd,
            savingsPercentage,
            isProfitable
        };
    }
}
exports.VisionCostCalculator = VisionCostCalculator;
//# sourceMappingURL=visionCostCalculator.js.map