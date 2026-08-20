import * as crypto from 'crypto';
import { Logger } from '../utils/logger';

export interface CacheEntry {
  response: string;
  timestamp: number;
  tokens: number;
}

/**
 * High-performance In-Memory Semantic Cache (LRU).
 * Reuses identical AI responses to bring latency to 0ms.
 */
export class SemanticCache {
  private static instance: SemanticCache;
  private cache = new Map<string, CacheEntry>();
  private readonly MAX_CACHE_SIZE = 100; // LRU Size
  private readonly logger = Logger.getInstance();

  private constructor() {}

  public static getInstance(): SemanticCache {
    if (!SemanticCache.instance) {
      SemanticCache.instance = new SemanticCache();
    }
    return SemanticCache.instance;
  }

  /**
   * Generates a unique SHA-256 hash for the request payload.
   */
  public generateHash(prompt: string, contextItems: any[], existingMessages: any[]): string {
    const payload = JSON.stringify({
      prompt,
      contextItems: contextItems.map(c => c.content), // Only hash the content
      existingMessages: existingMessages.map(m => m.content) // Only hash message contents
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  public get(hashKey: string): string | null {
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

  public set(hashKey: string, response: string, tokenCount: number): void {
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      // Evict least recently used (first item in Map)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(hashKey, {
      response,
      timestamp: Date.now(),
      tokens: tokenCount
    });
    this.logger.log(`[SemanticCache] STORED key: ${hashKey.substring(0, 8)}...`);
  }
}
