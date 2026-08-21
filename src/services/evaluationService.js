"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvaluationService = void 0;
const logger_1 = require("../utils/logger");
const llmEngine_1 = require("./llmEngine");
const configManager_1 = require("./configManager");
class EvaluationService {
    static instance;
    logger = logger_1.Logger.getInstance();
    llmEngine = llmEngine_1.LLMEngine.getInstance();
    context;
    constructor() { }
    static getInstance() {
        if (!EvaluationService.instance) {
            EvaluationService.instance = new EvaluationService();
        }
        return EvaluationService.instance;
    }
    initialize(context) {
        this.context = context;
    }
    /**
     * Asynchronously evaluates the generated output using LLM-as-a-judge.
     * This runs in the background and does not block the user UI.
     */
    async evaluateResponse(prompt, response, latencyMs, tokenCount) {
        try {
            this.logger.log(`Evaluating response... Latency: ${latencyMs}ms, Tokens: ${tokenCount}`);
            const config = configManager_1.ConfigManager.getInstance().getConfig();
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
                    onChunk: (chunk) => { evalResultText += chunk; },
                    onComplete: () => { },
                    onError: (err) => { this.logger.error('Eval failed', err); }
                }
            });
            // Clean up markdown wrapping if any
            evalResultText = evalResultText.replace(/```json/gi, '').replace(/```/gi, '').trim();
            try {
                const result = JSON.parse(evalResultText);
                this.logger.log(`📊 LLM Evaluation Score: ${result.score}/10 | Reason: ${result.reasoning}`);
                // Log telemetry internally or send to an analytics service
                this.logTelemetry(result.score, latencyMs, tokenCount);
            }
            catch (parseErr) {
                this.logger.warn(`Failed to parse evaluation JSON: ${evalResultText}`);
            }
        }
        catch (err) {
            this.logger.error('Error during LLM evaluation', err);
        }
    }
    async logTelemetry(score, latencyMs, tokens) {
        // In a real enterprise system, this would push to Datadog, Langfuse, or ELK
        this.logger.log(`[TELEMETRY] Score=${score}, Latency=${latencyMs}ms, Tokens=${tokens}`);
        if (this.context) {
            const historyKey = 'chanakya.tokenHistory';
            const history = this.context.globalState.get(historyKey) || [];
            if (history.length > 0) {
                // Update the last entry (the one that triggered this evaluation)
                history[history.length - 1].evaluationScore = score;
                await this.context.globalState.update(historyKey, history);
                this.logger.log(`[TELEMETRY] Updated evaluation score in history`);
            }
        }
    }
}
exports.EvaluationService = EvaluationService;
//# sourceMappingURL=evaluationService.js.map