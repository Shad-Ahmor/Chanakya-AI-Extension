import { Logger } from '../utils/logger';
import { LLMEngine } from './llmEngine';
import { ConfigManager } from './configManager';

export interface EvaluationResult {
  score: number;
  reasoning: string;
}

export class EvaluationService {
  private static instance: EvaluationService;
  private readonly logger = Logger.getInstance();
  private readonly llmEngine = LLMEngine.getInstance();
  private context?: import('vscode').ExtensionContext;

  private constructor() {}

  public static getInstance(): EvaluationService {
    if (!EvaluationService.instance) {
      EvaluationService.instance = new EvaluationService();
    }
    return EvaluationService.instance;
  }

  public initialize(context: import('vscode').ExtensionContext) {
    this.context = context;
  }

  /**
   * Asynchronously evaluates the generated output using LLM-as-a-judge.
   * This runs in the background and does not block the user UI.
   */
  public async evaluateResponse(prompt: string, response: string, latencyMs: number, tokenCount: number): Promise<void> {
    try {
      this.logger.log(`Evaluating response... Latency: ${latencyMs}ms, Tokens: ${tokenCount}`);
      
      const config = ConfigManager.getInstance().getConfig();
      const allModels = config.models || [];
      // Prefer a fast model for evaluation to save costs
      const evalModel = allModels.find(m => (m.id || m.name || '').toLowerCase().includes('haiku') || (m.id || m.name || '').toLowerCase().includes('mini')) || allModels[0];

      if (!evalModel) {
        return;
      }

      const evalPrompt = `
      You are an expert LLM-as-a-judge. Evaluate the following AI response to the user's prompt.
      Rate the response on a scale of 1 to 10 for Correctness, Safety, and Helpfulness.
      Provide only a JSON output in this exact format: {"score": 8, "reasoning": "brief reason"}

      [User Prompt]: ${prompt}
      [AI Response]: ${response}
      `;

      let evalResultText = '';
      
      // We use streamChat but just accumulate the result since it's background
      await this.llmEngine.streamChat({
        prompt: evalPrompt,
        contextItems: [],
        optimizerConfig: { responseConciseness: 'ultra_concise' }, // optimizer config
        callbacks: {
          onChunk: (chunk: string) => { evalResultText += chunk; },
          onComplete: () => {},
          onError: (err: any) => { this.logger.error('Eval failed', err); }
        }
      });

      // Clean up markdown wrapping if any and extract JSON
      evalResultText = evalResultText.replace(/```json/gi, '').replace(/```/gi, '').trim();
      const jsonMatch = evalResultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
          evalResultText = jsonMatch[0];
      }
      
      try {
        const result: EvaluationResult = JSON.parse(evalResultText);
        this.logger.log(`📊 LLM Evaluation Score: ${result.score}/10 | Reason: ${result.reasoning}`);
        
        // Log telemetry internally or send to an analytics service
        this.logTelemetry(result.score, latencyMs, tokenCount);

      } catch (parseErr) {
        this.logger.warn(`Failed to parse evaluation JSON: ${evalResultText}`);
      }

    } catch (err) {
      this.logger.error('Error during LLM evaluation', err);
    }
  }

  private async logTelemetry(score: number, latencyMs: number, tokens: number) {
    // In a real enterprise system, this would push to Datadog, Langfuse, or ELK
    this.logger.log(`[TELEMETRY] Score=${score}, Latency=${latencyMs}ms, Tokens=${tokens}`);
    
    if (this.context) {
      const historyKey = 'chanakya.tokenHistory';
      const history = this.context.globalState.get<any[]>(historyKey) || [];
      if (history.length > 0) {
        // Update the last entry (the one that triggered this evaluation)
        history[history.length - 1].evaluationScore = score;
        await this.context.globalState.update(historyKey, history);
        this.logger.log(`[TELEMETRY] Updated evaluation score in history`);
      }
    }
  }
}
