import { LLMGateway } from '../llmGateway';
import { ConfigManager } from '../configManager';
import { SkillEdit } from './candidateGenerator';

export interface DriftValidationResult {
    passed: boolean;
    reason: string;
}

export class SkillDriftValidator {
    private static instance: SkillDriftValidator;
    private llmGateway = LLMGateway.getInstance();

    private constructor() { }

    public static getInstance(): SkillDriftValidator {
        if (!SkillDriftValidator.instance) {
            SkillDriftValidator.instance = new SkillDriftValidator();
        }
        return SkillDriftValidator.instance;
    }

    public static resetInstance(): void {
        (SkillDriftValidator as any).instance = undefined;
    }

    public async validate(candidateContent: string, candidateEdits: SkillEdit[], originalContent: string): Promise<DriftValidationResult> {
        const prompt = `You are a strict Skill Optimizer Gatekeeper.
Your job is to prevent "skill drift" and bloat.
Analyze the original skill and the proposed candidate.

Check for the following constraints:
1. Is the edit generalizable? (No task-specific overfitting)
2. Does it conflict with any existing rules?
3. Does it duplicate existing content?
4. Does it unnecessarily increase the skill size?

Original Content:
\`\`\`markdown
${originalContent}
\`\`\`

Candidate Content:
\`\`\`markdown
${candidateContent}
\`\`\`

Edits made:
${JSON.stringify(candidateEdits, null, 2)}

Output ONLY a JSON object with this schema:
{
  "passed": boolean, // true if it passes ALL checks, false if it violates ANY
  "reason": "Detailed explanation of why it passed or failed"
}
No markdown, no other text.`;

        return new Promise<DriftValidationResult>((resolve, reject) => {
            let fullText = '';
            const activeOptimizerModelId = ConfigManager.getInstance().getConfig().activeOptimizerModelId;
            this.llmGateway.streamChat({
                prompt: prompt,
                contextItems: [],
                existingMessages: [{ role: 'system', content: 'You are a JSON-only API. Output only valid JSON.' }],
                targetModelId: activeOptimizerModelId,
                callbacks: {
                    onChunk: (c) => fullText += c,
                    onComplete: (t) => {
                        try {
                            let cleaned = (t.includes('</think>') ? t.split('</think>')[1] : t);
                            const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
                            cleaned = match ? match[0] : cleaned;
                            const result = JSON.parse(cleaned) as DriftValidationResult;
                            resolve(result);
                        } catch (e) {
                            reject(new Error('Failed to parse DriftValidationResult JSON: ' + (e as Error).message));
                        }
                    },
                    onError: (e) => reject(e)
                }
            });
        });
    }
}