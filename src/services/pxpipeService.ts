import { PxPipeRenderer, PxPipeRenderResult } from '../utils/pxpipeRenderer';
import { FactsheetExtractor } from '../utils/factsheetExtractor';
import { SchemaStripper } from '../utils/schemaStripper';
import { VisionCostCalculator } from '../utils/visionCostCalculator';
import { PxPipeTracker, PxPipeTelemetry, PxPipeEventLog } from './pxpipeTracker';
import { Logger } from '../utils/logger';

export interface PxPipeConfig {
  enabled: boolean;
  minCharThreshold: number; // default 2000
  targetModelProfile: 'claude' | 'gemini' | 'openai' | 'qwen' | 'auto';
  compressSystemPrompt: boolean;
  compressToolSchemas: boolean;
  compressOldHistory: boolean;
  stripJsonSchemaAnnotations: boolean;
  enablePromptPinning: boolean;
  keepRecentTurns: number; // default 2
}

export const DEFAULT_PXPIPE_CONFIG: PxPipeConfig = {
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

export class PxPipeService {
  private static instance: PxPipeService;
  private logger = Logger.getInstance();
  private tracker = PxPipeTracker.getInstance();

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
   * Structure-Aware JSON schema stripping for tools
   */
  public stripToolSchemas(tools: any[]): {
    strippedTools: any[];
    originalCharCount: number;
    strippedCharCount: number;
    savingsRatio: number;
  } {
    return SchemaStripper.stripToolCollection(tools);
  }

  /**
   * Convert bulky text to PxPipe visual image block if profitable
   */
  public compressText(
    text: string,
    title = 'CHANAKYA PXPIPE COMPRESSED CONTEXT',
    modelId = 'claude-3-7-sonnet',
    contextType: 'system_prompt' | 'mcp_schemas' | 'chat_history' | 'file_dump' = 'system_prompt'
  ): PxPipeRenderResult | null {
    if (!text || text.length < 1000) {
      return null;
    }

    try {
      const result = PxPipeRenderer.renderTextToPng(text, {
        title,
        columns: text.length > 5000 ? 2 : 1,
        showLineNumbers: true
      });

      // Calculate exact model pricing arbitrage
      const arbitrage = VisionCostCalculator.calculateArbitrage(
        result.charCount,
        modelId,
        result.width,
        result.height
      );

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

      this.logger.log(
        `[PxPipe] Compressed ${result.charCount} chars (~${arbitrage.textTokens} text tokens) to ~${arbitrage.imageTokens} image tokens. Savings: ${arbitrage.savingsPercentage}% (+$${arbitrage.dollarsSavedUsd.toFixed(4)})`
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
    accompanyingPrompt?: string,
    enablePinning = true
  ): any {
    const factsheetText = rendered.factsheet.length > 0
      ? `\n[EXACT IDENTIFIERS FACTSHEET - PRESERVED LOSSLESS]:\n${rendered.factsheet.map(f => `- ${f}`).join('\n')}\n`
      : '';

    const instruction = `The bulky context, system instructions, and tool documentation are rendered in the high-density image below (OCR readable with line numbers). Read the image directly to answer the user request.${factsheetText}\n${accompanyingPrompt || ''}`;

    if (provider === 'anthropic') {
      const textBlock: any = { type: 'text', text: instruction };
      const imgBlock: any = {
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

  /**
   * Export an offline PxPipe bundle (PNG image, factsheet text, prompt text, and manifest metadata)
   */
  public exportOfflineBundle(text: string, title?: string): {
    manifest: Record<string, any>;
    factsheetTxt: string;
    promptTxt: string;
    pngDataUri: string;
    pngBase64: string;
  } {
    const render = PxPipeRenderer.renderTextToPng(text, {
      title: title || 'CHANAKYA PXPIPE OFFLINE EXPORT',
      columns: text.length > 5000 ? 2 : 1,
      showLineNumbers: true
    });

    const factsheetResult = FactsheetExtractor.extract(text);
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

  public getTelemetry(): PxPipeTelemetry {
    return this.tracker.getTelemetry();
  }

  public getRecentLogs(): PxPipeEventLog[] {
    return this.tracker.getRecentEvents();
  }
}
