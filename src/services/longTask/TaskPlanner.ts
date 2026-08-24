import { TaskArtifact, TaskComplexity, TaskState } from './types';
import { PlanStore } from './PlanStore';
import { TaskDecomposer } from './TaskDecomposer';
import { Logger } from '../../utils/logger';

export class TaskPlanner {
    private readonly logger = Logger.getInstance();

    constructor(
        private readonly decomposer: TaskDecomposer,
        private readonly planStore: PlanStore
    ) {}

    public async initializePlan(prompt: string, complexity: TaskComplexity): Promise<TaskArtifact> {
        this.logger.log(`[TaskPlanner] Initializing plan for ${complexity} task.`);
        
        // Step 1: Decompose
        const artifact = await this.decomposer.decompose(prompt, complexity);
        
        // Step 2: Set Initial State
        artifact.state = TaskState.READY;
        artifact.updatedAt = Date.now();

        // Step 3: Persist Plan
        await this.planStore.saveTask(artifact);

        return artifact;
    }

    public async updatePlan(artifact: TaskArtifact): Promise<void> {
        artifact.updatedAt = Date.now();
        await this.planStore.saveTask(artifact);
    }
}
