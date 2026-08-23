import { Trajectory } from './trajectoryRecorder';
import { LLMGateway } from '../llmGateway';
import { ConfigManager } from '../configManager';

export interface Observation {
    problem: string;
    evidenceCount: number;
}

export interface ProceduralRule {
    whatWorked: string;
    whatFailed: string;
    causeOfFailure: string;
    proceduralRule: string;
}

export interface ReflectionResult {
    observations: Observation[];
    improvements: ProceduralRule[];
}

export class ReflectionEngine {
    private static instance: ReflectionEngine;
    private llmGateway = LLMGateway.getInstance();

    private constructor() {}

    public static getInstance(): ReflectionEngine {
        if (!ReflectionEngine.instance) {
            ReflectionEngine.instance = new ReflectionEngine();
        }
        return ReflectionEngine.instance;
    }

    public async reflect(trajectories: Trajectory[]): Promise<ReflectionResult> {
        if (trajectories.length === 0) {
            return { observations: [], improvements: [] };
        }

        let trajStr = JSON.stringify(trajectories, null, 2);
        if (trajStr.length > 6000) {
            trajStr = trajStr.substring(0, 6000) + '\n... (truncated due to length)';
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
      "whatWorked": "Description of actions that succeeded.",
      "whatFailed": "Description of the specific failure.",
      "causeOfFailure": "Root cause of why the failure occurred.",
      "proceduralRule": "A generalized, reusable behavioral rule to prevent this failure. Do not just summarize."
    }
  ]
}

Trajectories:
${trajStr}
`;

        return new Promise<ReflectionResult>((resolve, reject) => {
            let fullText = '';
            
            const activeOptimizerModelId = ConfigManager.getInstance().getConfig().activeOptimizerModelId;

            this.llmGateway.streamChat({
                prompt: prompt,
                contextItems: [],
                existingMessages: [{ role: 'system', content: 'You are a JSON-only API. Respond only with valid JSON. Do not use markdown blocks.' }],
                targetModelId: activeOptimizerModelId,
                callbacks: {
                    onChunk: (chunk: string) => {
                        fullText += chunk;
                    },
                    onComplete: (text: string) => {
                        try {
                            const jsonMatch = text.match(/\{[\s\S]*\}/);
                            const jsonString = jsonMatch ? jsonMatch[0] : text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                            const result = JSON.parse(jsonString) as ReflectionResult;
                            resolve(result);
                        } catch (e) {
                            // Fallback gracefully instead of crashing the pipeline
                            resolve({
                                observations: [
                                    { problem: "Unable to parse full reflection from LLM (Truncated JSON)", evidenceCount: 1 }
                                ],
                                improvements: [
                                    {
                                        whatWorked: "Task execution ran successfully.",
                                        whatFailed: "Reflection JSON was truncated by context limit or malformed.",
                                        causeOfFailure: "Model may require a larger maxOutputTokens or simpler task context.",
                                        proceduralRule: "Review the tool execution logic for robustness and ensure outputs are concise."
                                    }
                                ]
                            });
                        }
                    },
                    onError: (error: Error) => {
                        reject(error);
                    }
                }
            });
        });
    }
}
