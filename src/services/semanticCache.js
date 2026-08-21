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
exports.SemanticCache = void 0;
const crypto = __importStar(require("crypto"));
const logger_1 = require("../utils/logger");
/**
 * High-performance In-Memory Semantic Cache (LRU).
 * Reuses identical AI responses to bring latency to 0ms.
 */
class SemanticCache {
    static instance;
    cache = new Map();
    MAX_CACHE_SIZE = 100; // LRU Size
    logger = logger_1.Logger.getInstance();
    constructor() { }
    static getInstance() {
        if (!SemanticCache.instance) {
            SemanticCache.instance = new SemanticCache();
        }
        return SemanticCache.instance;
    }
    /**
     * Generates a unique SHA-256 hash for the request payload.
     */
    generateHash(prompt, contextItems, existingMessages) {
        const payload = JSON.stringify({
            prompt,
            contextItems: contextItems.map(c => c.content), // Only hash the content
            existingMessages: existingMessages.map(m => m.content) // Only hash message contents
        });
        return crypto.createHash('sha256').update(payload).digest('hex');
    }
    get(hashKey) {
        const entry = this.cache.get(hashKey);
        if (entry) {
            // Move to end (most recently used)
            this.cache.delete(hashKey);
            this.cache.set(hashKey, entry);
            this.logger.log(`[SemanticCache] HIT for key: ${hashKey.substring(0, 8)}... (Latency: 0ms)`);
            return entry.response;
        }
        this.logger.log(`[SemanticCache] MISS for key: ${hashKey.substring(0, 8)}...`);
        return null;
    }
    set(hashKey, response, tokenCount) {
        if (this.cache.size >= this.MAX_CACHE_SIZE) {
            // Evict least recently used (first item in Map)
            const firstKey = this.cache.keys().next().value;
            if (firstKey)
                this.cache.delete(firstKey);
        }
        this.cache.set(hashKey, {
            response,
            timestamp: Date.now(),
            tokens: tokenCount
        });
        this.logger.log(`[SemanticCache] STORED key: ${hashKey.substring(0, 8)}...`);
    }
}
exports.SemanticCache = SemanticCache;
//# sourceMappingURL=semanticCache.js.map