import { Trajectory } from './trajectoryRecorder';
import { AIService } from '../aiService';

export interface Observation {
    problem: string;
    evidenceCount: number;
}

export interface Improvement {
    instruction: string;
}

export interface ReflectionResult {
    observations: Observation[];
    improvements: Improvement[];
}

export class ReflectionEngine {
    private static instance: ReflectionEngine;
    private aiService = AIService.getInstance();

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
      "instruction": "A clear, actionable instruction for the agent to prevent this in the future."
    }
  ]
}

Trajectories:
${JSON.stringify(trajectories, null, 2)}
`;

        return new Promise<ReflectionResult>((resolve, reject) => {
            let fullText = '';
            
            this.aiService.streamCompletion({
                prompt: prompt,
                systemInstruction: 'You are a JSON-only API. Respond only with valid JSON. Do not use markdown blocks.',
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
