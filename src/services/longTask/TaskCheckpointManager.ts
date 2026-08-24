import { PlanStore } from './PlanStore';
import { TaskCheckpoint, TaskArtifact, TaskState } from './types';
import { Logger } from '../../utils/logger';
import * as crypto from 'crypto';

export class TaskCheckpointManager {
    private readonly logger = Logger.getInstance();
    // Idempotency: hash of the last tool call's args to prevent duplicate execution
    private lastToolCallHash: string = '';

    constructor(private readonly planStore: PlanStore) {}

    public async createCheckpoint(
        artifact: TaskArtifact,
        currentPhase: string | null,
        currentStep: string | null,
        modifiedFiles: string[],
        verifiedFiles: string[],
        decisions: string[],
        errors: string[]
    ): Promise<TaskCheckpoint> {
        this.logger.log(`[TaskCheckpointManager] Creating checkpoint for ${artifact.taskId} at ${currentPhase}/${currentStep}`);

        const completedSteps: string[] = [];
        const pendingSteps: string[] = [];

        for (const p of artifact.phases) {
            for (const s of p.steps) {
                if (s.status === TaskState.COMPLETED) {
                    completedSteps.push(s.stepId);
                } else if (s.status !== TaskState.CANCELLED) {
                    pendingSteps.push(s.stepId);
                }
            }
        }

        const checkpoint: TaskCheckpoint = {
            taskId: artifact.taskId,
            currentPhase,
            currentStep,
            completedSteps,
            pendingSteps,
            modifiedFiles,
            verifiedFiles,
            testResults: [],
            decisions,
            errors,
            timestamp: Date.now(),
            ...(artifact.workingSet !== undefined && { currentWorkingSet: artifact.workingSet })
        };

        await this.planStore.saveCheckpoint(checkpoint);
        this.logger.log(`[TaskCheckpointManager] ✓ Checkpoint saved: ${completedSteps.length} complete, ${pendingSteps.length} pending`);
        return checkpoint;
    }

    public async loadLatestCheckpoint(taskId: string): Promise<TaskCheckpoint | null> {
        return await this.planStore.loadCheckpoint(taskId);
    }

    /**
     * Idempotency guard: checks if this exact tool call has already been executed.
     * Prevents duplicate tool executions after crash recovery.
     */
    public isToolCallDuplicate(toolName: string, args: Record<string, unknown>): boolean {
        const hash = crypto.createHash('sha256')
            .update(JSON.stringify({ toolName, args }))
            .digest('hex');
        
        if (hash === this.lastToolCallHash) {
            this.logger.warn(`[TaskCheckpointManager] Duplicate tool call detected for ${toolName} — skipping`);
            return true;
        }
        this.lastToolCallHash = hash;
        return false;
    }

    /**
     * Determines the execution state of a step based on checkpoint state.
     */
    public getStepState(stepId: string, checkpoint: TaskCheckpoint): 'NOT_STARTED' | 'COMPLETED' | 'PENDING' {
        if (checkpoint.completedSteps.includes(stepId)) return 'COMPLETED';
        if (checkpoint.pendingSteps.includes(stepId)) return 'PENDING';
        return 'NOT_STARTED';
    }
}

