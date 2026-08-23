import { LLMGateway } from '../llmGateway';
import { ConfigManager } from '../configManager';
import { TrajectoryRecorder } from './trajectoryRecorder';
import { SkillTask } from './taskDatasetManager';
import { Logger } from '../../utils/logger';

import * as vscode from 'vscode';
import { TaskUnderstander } from '../taskUnderstander';

export class RolloutEngine {
    private static instance: RolloutEngine;
    private llmGateway = LLMGateway.getInstance();
    private recorder: TrajectoryRecorder;
    private logger = Logger.getInstance();

    private constructor(workspaceRoot: string) {
        this.recorder = TrajectoryRecorder.getInstance(workspaceRoot);
    }

    public static getInstance(workspaceRoot: string): RolloutEngine {
        if (!RolloutEngine.instance) {
            RolloutEngine.instance = new RolloutEngine(workspaceRoot);
        }
        return RolloutEngine.instance;
    }

    public static resetInstance(): void {
        (RolloutEngine as any).instance = undefined;
    }

    /**
     * Executes a task using the real LLM engine and AgentOrchestrator.
     */
    public async executeTask(skillName: string, skillVersion: number, _skillContent: string, task: SkillTask): Promise<boolean> {
        this.logger.log(`[RolloutEngine] Starting task ${task.id} for skill ${skillName} v${skillVersion}`);
        
        let success = false;
        try {
            const workspaceRoot = task.workspace || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
            const routingInfo = await TaskUnderstander.getInstance(workspaceRoot).understandTask(task.description);
            
            const optimizerConfig = {
                ...routingInfo,
                needsMCP: true,
                relevantSkills: [skillName],
                isRollout: true
            };

            const activeOptimizerModelId = ConfigManager.getInstance().getConfig().activeOptimizerModelId;
            
            await new Promise<void>((resolve, reject) => {
                this.llmGateway.streamChat({
                    prompt: task.description + '\n\nExpected Outcome:\n' + task.expectedOutcome,
                    contextItems: [],
                    optimizerConfig: optimizerConfig,
                    targetModelId: activeOptimizerModelId,
                    taskId: task.id,
                    skillName: skillName,
                    skillVersion: skillVersion,
                    ...(task.workspace ? { customWorkspace: task.workspace } : {}),
                    callbacks: {
                        onChunk: (_chunk: string) => {},
                        onComplete: () => { resolve(); },
                        onError: (error: Error) => { reject(error); }
                    }
                });
            });

            const trajectory = this.recorder.getTrajectory(task.id);
            if (trajectory) {
                success = trajectory.success;
            }
        } catch (e: any) {
            this.logger.error(`[RolloutEngine] Task ${task.id} failed`, e);
            const trajectory = this.recorder.getTrajectory(task.id);
            if (!trajectory) {
                this.recorder.startTask(task.id, task.description, skillName, skillVersion);
                this.recorder.recordToolCall(task.id, 'error', { error: e.message }, undefined, e.message);
                this.recorder.endTask(task.id, false);
            }
        }
        
        return success;
    }
}
