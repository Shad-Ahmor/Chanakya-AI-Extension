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
${JSON.stringify(trajectories, null, 2)}
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
                            const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                            const result = JSON.parse(cleanedText) as ReflectionResult;
                            resolve(result);
                        } catch (e) {
                            reject(new Error('Failed to parse reflection JSON: ' + (e as Error).message));
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
