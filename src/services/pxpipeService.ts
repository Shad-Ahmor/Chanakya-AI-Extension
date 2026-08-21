import { PxPipeRenderer, PxPipeRenderResult } from '../utils/pxpipeRenderer';
import { Logger } from '../utils/logger';

export interface PxPipeConfig {
  enabled: boolean;
  minCharThreshold: number; // default 2000
  targetModelProfile: 'claude' | 'gemini' | 'openai' | 'qwen' | 'auto';
  compressSystemPrompt: boolean;
  compressToolSchemas: boolean;
  compressOldHistory: boolean;
  keepRecentTurns: number; // default 2
}

export const DEFAULT_PXPIPE_CONFIG: PxPipeConfig = {
  enabled: true,
  minCharThreshold: 2000,
  targetModelProfile: 'auto',
  compressSystemPrompt: true,
  compressToolSchemas: true,
  compressOldHistory: true,
  keepRecentTurns: 2
};

export class PxPipeService {
  private static instance: PxPipeService;
  private logger = Logger.getInstance();

  private constructor() {}

  public static getInstance(): PxPipeService {
    if (!PxPipeService.instance) {
      PxPipeService.instance = new PxPipeService();
    }
    return PxPipeService.instance;
  }

  /**
   * Determine if an LLM is vision-capable (accepts images in user/system messages)
   */
  public isVisionCapable(modelId: string): boolean {
    const m = (modelId || '').toLowerCase();
    return (
      m.includes('claude') ||
      m.includes('gemini') ||
      m.includes('gpt-4o') ||
      m.includes('gpt-4.5') ||
      m.includes('gpt-5') ||
      m.includes('qwen') ||
      m.includes('vision') ||
      m.includes('vl') ||
      m.includes('fable') ||
      m.includes('opus') ||
      m.includes('sonnet')
    );
  }

  /**
   * Convert bulky text to PxPipe visual image block if profitable
   */
  public compressText(text: string, title?: string): PxPipeRenderResult | null {
    if (!text || text.length < 1000) {
      return null;
    }

    try {
      const result = PxPipeRenderer.renderTextToPng(text, {
        title: title || 'CHANAKYA PXPIPE COMPRESSED CONTEXT',
        columns: text.length > 5000 ? 2 : 1,
        showLineNumbers: true
      });

      this.logger.log(
        `[PxPipe] Compressed ${result.charCount} chars (~${result.estimatedTextTokens} text tokens) to ~${result.estimatedImageTokens} image tokens. Savings: ${result.savingsPercentage}%`
      );

      return result;
    } catch (err: any) {
      this.logger.error('[PxPipe] Failed to compress text to image:', err);
      return null;
    }
  }

  /**
   * Format image data as standard multi-modal content parts across model providers
   */
  public formatMultimodalMessage(
    provider: 'anthropic' | 'openai' | 'gemini',
    rendered: PxPipeRenderResult,
    accompanyingPrompt?: string
  ): any {
    const factsheetText = rendered.factsheet.length > 0
      ? `\n[EXACT IDENTIFIERS FACTSHEET - PRESERVED LOSSLESS]:\n${rendered.factsheet.map(f => `- ${f}`).join('\n')}\n`
      : '';

    const instruction = `The bulky context, system instructions, and tool documentation are rendered in the high-density image below (OCR readable with line numbers). Read the image directly to answer the user request.${factsheetText}\n${accompanyingPrompt || ''}`;

    if (provider === 'anthropic') {
      return [
        { type: 'text', text: instruction },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: rendered.base64
          }
        }
      ];
    } else if (provider === 'gemini') {
      return [
        { text: instruction },
        {
          inlineData: {
            mimeType: 'image/png',
            data: rendered.base64
          }
        }
      ];
    } else {
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
}
