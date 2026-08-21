"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReflectionEngine = void 0;
const aiService_1 = require("../aiService");
class ReflectionEngine {
    static instance;
    aiService = aiService_1.AIService.getInstance();
    constructor() { }
    static getInstance() {
        if (!ReflectionEngine.instance) {
            ReflectionEngine.instance = new ReflectionEngine();
        }
        return ReflectionEngine.instance;
    }
    async reflect(trajectories) {
        if (trajectories.length === 0) {
            return { observations: [], improvements: [] };
        }
        const prompt = `You are an expert AI agent behavior analyst.
Analyze the following JSON array of task execution trajectories.
Identify repeated behavioral problems, tool misuse, retries, and recurring mistakes.
Do NOT create rules from single random failures. Look for evidence across multiple runs.
Return your analysis as ONLY a JSON object matching exactly this schema, with no markdown formatting or extra text:
{
  "observations": [
    {
      "problem": "Brief description of the problem",
      "evidenceCount": <number of trajectories exhibiting this problem>
    }
  ],
  "improvements": [
    {
      "instruction": "A clear, actionable instruction for the agent to prevent this in the future."
    }
  ]
}

Trajectories:
${JSON.stringify(trajectories, null, 2)}
`;
        return new Promise((resolve, reject) => {
            let fullText = '';
            this.aiService.streamCompletion({
                prompt: prompt,
                systemInstruction: 'You are a JSON-only API. Respond only with valid JSON. Do not use markdown blocks.',
                callbacks: {
                    onChunk: (chunk) => {
                        fullText += chunk;
                    },
                    onComplete: (text) => {
                        try {
                            const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                            const result = JSON.parse(cleanedText);
                            resolve(result);
                        }
                        catch (e) {
                            reject(new Error('Failed to parse reflection JSON: ' + e.message));
                        }
                    },
                    onError: (error) => {
                        reject(error);
                    }
                }
            });
        });
    }
}
exports.ReflectionEngine = ReflectionEngine;
//# sourceMappingURL=reflectionEngine.js.map