import { LLMEngine } from './llmEngine';
import { ConfigManager } from './configManager';
import { Logger } from '../utils/logger';
import { ChatMessage } from '../types/ipc';

export class CompressionAgent {
  private static instance: CompressionAgent;
  private readonly logger = Logger.getInstance();
  private readonly llmEngine = LLMEngine.getInstance();

  private constructor() {}

  public static getInstance(): CompressionAgent {
    if (!CompressionAgent.instance) {
      CompressionAgent.instance = new CompressionAgent();
    }
    return CompressionAgent.instance;
  }

  /**
   * Intelligently summarizes a large conversation history or codebase chunk into a dense, token-optimized string.
   */
  public async compressContext(messages: ChatMessage[], maxTokensOutput: number = 2000): Promise<string> {
    this.logger.log(`[CompressionAgent] Starting compression for ${messages.length} messages.`);
    
    const config = ConfigManager.getInstance().getConfig();
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
          onChunk: (chunk: string) => { compressedText += chunk; },
          onComplete: () => {},
          onError: (err: any) => { this.logger.error('Compression failed', err); }
        }
      });
      
      this.logger.log(`[CompressionAgent] Successfully compressed context. Length: ${compressedText.length}`);
      return compressedText.trim();
      
    } catch (err) {
      this.logger.error('[CompressionAgent] Error during compression, returning fallback raw text.', err);
      // Fallback
      return rawText.slice(0, maxTokensOutput * 4); // rough character fallback
    }
  }
}
