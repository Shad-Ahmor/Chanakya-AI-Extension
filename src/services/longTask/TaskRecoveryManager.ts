import { PlanStore } from './PlanStore';
import { TaskCheckpointManager } from './TaskCheckpointManager';
import { TaskArtifact, TaskState } from './types';
import { Logger } from '../../utils/logger';
import * as crypto from 'crypto';

export class TaskRecoveryManager {
    private readonly logger = Logger.getInstance();

    constructor(
        private readonly planStore: PlanStore,
        private readonly checkpointManager: TaskCheckpointManager
    ) {}

    /**
     * Attempts to find a resumable task for the given prompt hash.
     * Returns the recovered artifact if found, null if this is a fresh task.
     */
    public async tryRecover(prompt: string): Promise<TaskArtifact | null> {
        const promptHash = crypto.createHash('sha256').update(prompt.trim()).digest('hex').substring(0, 8);
        this.logger.log(`[TaskRecoveryManager] Checking for resumable task with hash ${promptHash}`);

        const allInProgress = await this.planStore.listInProgressTasks();
        for (const taskId of allInProgress) {
            const artifact = await this.planStore.loadTask(taskId);
            if (!artifact) continue;

            // Simple heuristic: check if task is in a recoverable state
            if (artifact.state === TaskState.EXECUTING || artifact.state === TaskState.RECOVERING || artifact.state === TaskState.PAUSED) {
                this.logger.log(`[TaskRecoveryManager] Found resumable task: ${taskId} (state: ${artifact.state})`);
                return await this.attemptRecovery(taskId);
            }
        }

        return null;
    }

    public async attemptRecovery(taskId: string): Promise<TaskArtifact | null> {
        this.logger.log(`[TaskRecoveryManager] Attempting recovery for task ${taskId}`);

        const artifact = await this.planStore.loadTask(taskId);
        if (!artifact) {
            this.logger.warn(`[TaskRecoveryManager] No TASK.json found for ${taskId}`);
            return null;
        }

        if (artifact.state === TaskState.COMPLETED || artifact.state === TaskState.CANCELLED) {
            this.logger.log(`[TaskRecoveryManager] Task ${taskId} is already ${artifact.state}`);
            return artifact;
        }

        const checkpoint = await this.checkpointManager.loadLatestCheckpoint(taskId);
        if (!checkpoint) {
            this.logger.warn(`[TaskRecoveryManager] No checkpoint found for ${taskId}. Resuming from step 1.`);
            artifact.state = TaskState.RECOVERING;
            return artifact;
        }

        this.logger.log(`[TaskRecoveryManager] ♻️ Recovering from checkpoint: ${new Date(checkpoint.timestamp).toISOString()}`);
        this.logger.log(`[TaskRecoveryManager]   Completed: ${checkpoint.completedSteps.length} steps, Pending: ${checkpoint.pendingSteps.length} steps`);
        
        // Sync artifact states from checkpoint
        for (const phase of artifact.phases) {
            for (const step of phase.steps) {
                if (checkpoint.completedSteps.includes(step.stepId)) {
                    step.status = TaskState.COMPLETED;
                } else if (checkpoint.currentStep === step.stepId) {
                    // This step was interrupted — reset it to be re-executed safely
                    step.status = TaskState.PENDING;
                }
            }
        }

        // Restore working set
        if (checkpoint.currentWorkingSet) {
            artifact.workingSet = checkpoint.currentWorkingSet;
        }

        artifact.state = TaskState.RECOVERING;
        await this.planStore.saveTask(artifact);
        
        return artifact;
    }
}

