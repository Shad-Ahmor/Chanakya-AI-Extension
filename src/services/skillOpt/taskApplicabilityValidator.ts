import { LLMGateway } from '../llmGateway';
import { ConfigManager } from '../configManager';
import { ReasonCode } from './types';

export interface ApplicabilityResult {
    applicable: 'YES' | 'NO' | 'UNCERTAIN' | 'BLOCKED';
    reasonCode: ReasonCode;
    evidence: string[];
    reason: string;
}

export class TaskApplicabilityValidator {
    private llmGateway = LLMGateway.getInstance();
    private static instance: TaskApplicabilityValidator;

    public static getInstance(): TaskApplicabilityValidator {
        if (!TaskApplicabilityValidator.instance) {
            TaskApplicabilityValidator.instance = new TaskApplicabilityValidator();
        }
        return TaskApplicabilityValidator.instance;
    }

    public async validate(taskDescription: string, baselineTrajectory: any): Promise<ApplicabilityResult> {
        const prompt = `You are a pre-execution Task Applicability Validator.
Your job is to determine if a requested task is actually applicable to the repository based on the evidence collected during the baseline agent's execution.

Task Description:
${taskDescription}

Baseline Trajectory Summary:
- Success: ${baselineTrajectory.success}
- Tool Calls: ${baselineTrajectory.toolCalls.map((tc: any) => tc.toolName).join(', ')}
- Final Output: ${baselineTrajectory.toolCalls.length > 0 ? baselineTrajectory.toolCalls[baselineTrajectory.toolCalls.length - 1].output?.substring(0, 500) : 'None'}

Did the agent find the necessary targets to perform the task, or did it fail because the required components/infrastructure do not exist (e.g., requested a dashboard but repo is a calculator)?
Was the execution blocked by external factors (e.g., permission denied, tool missing)?

Respond STRICTLY with a JSON object matching this schema:
{
    "applicable": "YES" | "NO" | "UNCERTAIN" | "BLOCKED",
    "reasonCode": "TASK_TARGET_NOT_FOUND" | "NO_RELEVANT_CODE_FOUND" | "MCP_PERMISSION_DENIED" | "ENVIRONMENT_UNAVAILABLE" | "TASK_NEEDS_CLARIFICATION" | "VALID_TO_PROCEED",
    "reason": "Short explanation of why",
    "evidence": ["Evidence 1", "Evidence 2"]
}`;

        return new Promise<ApplicabilityResult>((resolve, reject) => {
            let fullText = '';
            const activeOptimizerModelId = ConfigManager.getInstance().getConfig().activeOptimizerModelId;

            this.llmGateway.streamChat({
                prompt: prompt,
                contextItems: [],
                existingMessages: [{ role: 'system', content: 'You are a JSON-only API. Respond only with a valid JSON object.' }],
                targetModelId: activeOptimizerModelId,
                callbacks: {
                    onChunk: (chunk: string) => {
                        fullText += chunk;
                    },
                    onComplete: () => {
                        try {
                            const cleaned = fullText.replace(/```json/g, '').replace(/```/g, '').trim();
                            const result = JSON.parse(cleaned) as ApplicabilityResult;
                            resolve(result);
                        } catch (e) {
                            // If parsing fails, default to YES to not block execution
                            resolve({
                                applicable: 'YES',
                                reasonCode: 'VALID_TO_PROCEED' as any,
                                reason: 'Failed to parse validator output',
                                evidence: []
                            });
                        }
                    },
                    onError: (err) => {
                        reject(err);
                    }
                }
            });
        });
    }
}
