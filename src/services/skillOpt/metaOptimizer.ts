import { LLMGateway } from '../llmGateway';
import { ConfigManager } from '../configManager';
import { TrajectoryRecorder } from './trajectoryRecorder';
import { RejectedEditBuffer } from './rejectedEditBuffer';

export interface MetaOptimizationReport {
    skillId: string;
    proceduralLessons: string[];
    redundantBehaviors: string[];
    timestamp: number;
}

export class MetaOptimizer {
    private static instance: MetaOptimizer;
    private llmGateway = LLMGateway.getInstance();

    private constructor(private workspaceRoot: string) { }

    public static getInstance(workspaceRoot: string): MetaOptimizer {
        if (!MetaOptimizer.instance) {
            MetaOptimizer.instance = new MetaOptimizer(workspaceRoot);
        }
        return MetaOptimizer.instance;
    }

    public static resetInstance(): void {
        (MetaOptimizer as any).instance = undefined;
    }

    public async runMetaOptimization(skillId: string): Promise<MetaOptimizationReport> {
        const trajectories = TrajectoryRecorder.getInstance(this.workspaceRoot).getTrajectories().filter(t => t.skill === skillId);
        const rejectedEdits = RejectedEditBuffer.getInstance(this.workspaceRoot).getRejectedEditsForSkill(skillId);

        if (trajectories.length === 0 && rejectedEdits.length === 0) {
            return {
                skillId,
                proceduralLessons: [],
                redundantBehaviors: [],
                timestamp: Date.now()
            };
        }

        const prompt = `You are a Meta-Optimization Analyst.
Your job is to look at the historical trajectory of a skill's training process and extract high-level procedural lessons.
You will review a summary of executed tasks (trajectories) and rejected skill candidate edits.

Find recurring patterns:
1. What types of edits consistently fail? (Redundant behaviors)
2. What are overarching principles that should be applied to future updates? (Procedural lessons)

Trajectories Summary (Max 10):
${JSON.stringify(trajectories.slice(-10).map(t => ({ taskId: t.taskId, version: t.skillVersion })), null, 2)}

Rejected Edits (Max 5):
${JSON.stringify(rejectedEdits.slice(-5).map(r => ({ reason: r.rejectionReason, edits: r.candidateEdit })), null, 2)}

Output your findings ONLY as a JSON object matching this schema:
{
  "proceduralLessons": ["lesson 1", "lesson 2"],
  "redundantBehaviors": ["behavior 1", "behavior 2"]
}
No markdown, no explanation. Just the JSON object.`;

        return new Promise<MetaOptimizationReport>((resolve, reject) => {
            let fullText = '';
            const activeOptimizerModelId = ConfigManager.getInstance().getConfig().activeOptimizerModelId;
            this.llmGateway.streamChat({
                prompt: prompt,
                contextItems: [],
                existingMessages: [{ role: 'system', content: 'You are a JSON-only API. Respond only with valid JSON.' }],
                targetModelId: activeOptimizerModelId,
                callbacks: {
                    onChunk: (chunk: string) => fullText += chunk,
                    onComplete: (text: string) => {
                        try {
                            let cleaned = (text.includes('</think>') ? text.split('</think>')[1] : text);
                            const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
                            cleaned = match ? match[0] : cleaned;
                            const result = JSON.parse(cleaned);
                            resolve({
                                skillId,
                                proceduralLessons: result.proceduralLessons || [],
                                redundantBehaviors: result.redundantBehaviors || [],
                                timestamp: Date.now()
                            });
                        } catch (e) {
                            reject(new Error('Failed to parse MetaOptimizationReport JSON: ' + (e as Error).message));
                        }
                    },
                    onError: (e) => reject(e)
                }
            });
        });
    }
}