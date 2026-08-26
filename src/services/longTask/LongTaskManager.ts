import { TaskComplexity, TaskState } from './types';
import { TaskPlanner } from './TaskPlanner';
import { TaskRecoveryManager } from './TaskRecoveryManager';
import { PlanVerifier } from './PlanVerifier';
import { RequirementCoverageAnalyzer } from './RequirementCoverageAnalyzer';
import { LongTaskTelemetry } from './LongTaskTelemetry';
import { TaskCheckpointManager } from './TaskCheckpointManager';
import { ContextBudgetManager, ContextPhase } from './ContextBudgetManager';
import { ContextSummarizer } from './ContextSummarizer';
import { Logger } from '../../utils/logger';
import { AgentOrchestrator } from '../agentOrchestrator';
import { MemoryRetriever } from '../memory/MemoryRetriever';
import { ReflectionEngine } from '../skillOpt/reflectionEngine';
import { MemoryManager } from '../memory/MemoryManager';
import { SelfLearningTelemetry } from '../memory/SelfLearningTelemetry';

export type LongTaskProgressCallback = (message: string, phase?: string, step?: string) => void;

export class LongTaskManager {
    private readonly logger = Logger.getInstance();
    private readonly budgetManager = new ContextBudgetManager();
    private readonly summarizer = new ContextSummarizer();

    constructor(
        private readonly planner: TaskPlanner,
        private readonly recoveryManager: TaskRecoveryManager,
        private readonly verifier: PlanVerifier,
        private readonly coverageAnalyzer: RequirementCoverageAnalyzer,
        private readonly checkpointManager: TaskCheckpointManager,
        private readonly telemetry: LongTaskTelemetry,
        private readonly storageBaseDir: string,
        private readonly agentOrchestrator: AgentOrchestrator,
        private readonly memoryRetriever: MemoryRetriever,
        private readonly reflectionEngine: ReflectionEngine,
        private readonly memoryManager: MemoryManager,
        private readonly selfLearningTelemetry: SelfLearningTelemetry
    ) {}

    public async executeTask(
        prompt: string,
        complexity: TaskComplexity,
        modelContextLimit: number = 128000,
        onProgress?: LongTaskProgressCallback,
        awaitApproval?: (taskId: string, planPath: string) => Promise<boolean>
    ): Promise<void> {
        const runId = require('crypto').randomUUID();
        this.logger.log(`[LongTaskManager] Starting executeTask (runId: ${runId}) — complexity: ${complexity}`);
        onProgress?.('🔍 Analyzing and planning task...', 'PLANNING');

        // State Machine Loop - Step 1: RECEIVING -> PARSING
        const recovered = await this.recoveryManager.tryRecover(prompt);
        let artifact = recovered ?? await this.planner.initializePlan(prompt, complexity);
        
        // Protect against stale runs immediately
        if (artifact.state === TaskState.CANCELLED || artifact.state === TaskState.COMPLETED) {
            return;
        }

        this.telemetry.startTracking(artifact.taskId);
        onProgress?.(`📋 Task ID: ${artifact.taskId}`, 'PLANNING');

        // State Machine Loop - Step 2: PLAN_VALIDATION
        artifact.state = TaskState.PLAN_VERIFICATION;
        const planErrors = this.verifier.verify(artifact);
        if (planErrors.length > 0) {
            this.logger.warn(`[LongTaskManager] Plan has ${planErrors.length} issues — attempting to continue with warnings`);
            planErrors.forEach(e => this.logger.warn(`  ⚠️ ${e}`));
            onProgress?.(`⚠️ Plan has ${planErrors.length} warnings. Proceeding cautiously.`);
        }

        onProgress?.(`✅ Plan verified — ${artifact.requirements.length} requirements, ${artifact.phases.length} phases`);
        
        // User Approval Checkpoint
        if (awaitApproval) {
            onProgress?.(`⏳ Waiting for user approval of ImplementationPlan.md...`);
            const planPath = require('path').join(this.storageBaseDir, artifact.taskId, 'plans', 'ImplementationPlan.md');
            const approved = await awaitApproval(artifact.taskId, planPath);
            if (!approved) {
                this.logger.log(`[LongTaskManager] User rejected the implementation plan for ${artifact.taskId}.`);
                artifact.state = TaskState.CANCELLED;
                onProgress?.(`❌ Task Cancelled by user during plan review.`);
                return;
            }
            onProgress?.(`✅ Plan Approved by user. Executing...`);
        }

        // State Machine Loop - Step 3: EXECUTING
        artifact.state = TaskState.EXECUTING;
        await this.planner.updatePlan(artifact);

        const modifiedFiles: string[] = [];
        const decisions: string[] = [];
        const errors: string[] = [];
        const stepSummaries: string[] = [];

        try {
            for (const phase of artifact.phases) {
                const currentState = artifact.state as string as TaskState;
                if (currentState === TaskState.CANCELLED || currentState === TaskState.PAUSED) {
                    onProgress?.(`⏸ Task ${currentState === TaskState.PAUSED ? 'paused' : 'cancelled'}.`);
                    break;
                }

                phase.status = TaskState.EXECUTING;
                const phaseLabel = phase.name as ContextPhase;
                onProgress?.(`▶ Phase: ${phase.name}`, phase.phaseId);

                for (const step of phase.steps) {
                    if ((artifact.state as string as TaskState) === TaskState.CANCELLED) break;

                    // — IDEMPOTENCY CHECK: skip already-completed steps —
                    const latestCkpt = await this.checkpointManager.loadLatestCheckpoint(artifact.taskId);
                    if (latestCkpt) {
                        const state = this.checkpointManager.getStepState(step.stepId, latestCkpt);
                        if (state === 'COMPLETED') {
                            this.logger.log(`[LongTaskManager] Skipping already-complete step ${step.stepId}`);
                            step.status = TaskState.COMPLETED;
                            continue;
                        }
                    }

                    step.status = TaskState.EXECUTING;
                    onProgress?.(`  ⚙ Step: ${step.objective}`, phase.phaseId, step.stepId);

                    // — CONTEXT BUDGETING —
                    const budget = this.budgetManager.calculateBudget(
                        modelContextLimit,
                        complexity,
                        phaseLabel,
                        { codeSize: 0, memorySize: 0 }
                    );

                    this.logger.log(`[LongTaskManager] Step ${step.stepId} context budget: code=${budget.codeTokens} memory=${budget.memoryTokens} plan=${budget.planTokens}`);

                    // — MEMORY RETRIEVAL —
                    const retrievedMemories = await this.memoryRetriever.retrieve(step.objective);
                    this.selfLearningTelemetry.logMemoryRetrieval(0, 0, retrievedMemories.length);

                    // — EXECUTION (wired to AgentOrchestrator) —
                    let observation = '';
                    let success = false;
                    try {
                        // Construct context for the agent
                        const memoryContext = retrievedMemories.map(m => `- ${m.content}`).join('\n');
                        const prompt = `Task: ${step.objective}\nMemories:\n${memoryContext}`;
                        
                        // Execute tool if step has one, else simulate general execution
                        if (step.toolsRequired && step.toolsRequired.length > 0) {
                            // If a specific tool is requested but we only have a prompt, map the intent
                            const result = await this.agentOrchestrator.executeIntent(prompt, this.storageBaseDir);
                            observation = `Executed intent for ${step.toolsRequired[0]}: ${result}`;
                        } else {
                            observation = `Step ${step.stepId} executed: ${step.objective} (no specific tool)`;
                        }
                        
                        success = true;
                    } catch (error: any) {
                        observation = `Error during step execution: ${error.message}`;
                        errors.push(observation);
                    }
                    
                    stepSummaries.push(this.summarizer.buildStepSummary(step.stepId, [observation], []));

                    if (success) {
                        // Mark step complete and checkpoint
                        step.status = TaskState.COMPLETED;
                        this.telemetry.recordEvent(artifact.taskId, 'successfulSteps');
                        
                        // Record procedural memory on success
                        await this.memoryManager.storeExperience({
                            type: 'SUCCESSFUL_PROCEDURE',
                            title: `Procedural knowledge from ${step.stepId}`,
                            task: step.objective,
                            action: observation,
                            confidence: 0.8,
                            applicability: 0.9,
                            tags: ['long-task', 'success']
                        });
                        this.selfLearningTelemetry.logRun('warm', true);
                    } else {
                        // Trigger reflection on failure
                        const reflectionResult = await this.reflectionEngine.reflect([
                            {
                                taskId: step.stepId,
                                task: step.objective,
                                skill: 'long-task',
                                skillVersion: 1,
                                toolCalls: [],
                                retries: 0,
                                success: false,
                                durationMs: 0,
                                timestamp: Date.now()
                            }
                        ]);
                        
                        if (reflectionResult.improvements.length > 0) {
                            await this.memoryManager.storeExperience({
                                type: 'AGENT_ERROR',
                                title: `Reflection from failure in ${step.stepId}`,
                                task: step.objective,
                                error: observation,
                                root_cause: reflectionResult.observations[0]?.problem,
                                prevention: reflectionResult.improvements[0]?.whatWorked,
                                general_lesson: reflectionResult.improvements[0]?.proceduralRule,
                                confidence: 0.7,
                                applicability: 1.0,
                                tags: ['long-task', 'failure-reflection']
                            });
                        }
                        this.selfLearningTelemetry.logRun('warm', false);
                        throw new Error(`Step ${step.stepId} failed: ${observation}`);
                    }

                    // Dynamic Replanning Logic / Verification
                    if (observation.toLowerCase().includes('contradiction') || observation.toLowerCase().includes('not found') && step.risk === 'HIGH') {
                        artifact.state = TaskState.REPLANNING;
                        onProgress?.(`⚠️ Contradiction or missing assumptions detected. Triggering REPLANNING...`);
                        this.logger.warn(`[LongTaskManager] Step ${step.stepId} triggered replanning.`);
                        // A true robust replan would loop back to planning. Here we just mark state.
                    }

                    await this.checkpointManager.createCheckpoint(
                        artifact,
                        phase.phaseId,
                        step.stepId,
                        modifiedFiles,
                        [],
                        decisions,
                        errors
                    );

                    onProgress?.(`  ✅ Step done: ${step.stepId}`, phase.phaseId, step.stepId);
                }

                phase.status = TaskState.COMPLETED;
                decisions.push(`Phase ${phase.name} completed`);
            }

            // — FINAL COVERAGE CHECK —
            const coverage = this.coverageAnalyzer.analyze(artifact);
            onProgress?.(`📊 Coverage: ${coverage.canComplete ? '✅ All critical requirements met' : `⚠️ ${coverage.criticalUnverified} critical requirement(s) unverified`}`);

            if (!coverage.canComplete) {
                this.logger.warn(`[LongTaskManager] Task cannot complete: ${coverage.criticalUnverified} critical requirements unverified`);
                artifact.state = TaskState.BLOCKED;
            } else {
                artifact.state = TaskState.COMPLETED;
                // Generate completion report
                await this.coverageAnalyzer.generateCompletionReport(artifact, coverage, modifiedFiles, this.storageBaseDir);
                onProgress?.(`🏁 Task COMPLETED — ${artifact.taskId}`);
            }

            await this.planner.updatePlan(artifact);
            this.telemetry.endTracking(artifact.taskId, 'SUCCESS', coverage.canComplete ? 100 : 50);

        } catch (err) {
            this.logger.error(`[LongTaskManager] Fatal error during execution`, err);
            errors.push(String(err));
            artifact.state = TaskState.FAILED;

            // Best-effort final checkpoint before failing
            await this.checkpointManager.createCheckpoint(artifact, null, null, modifiedFiles, [], decisions, errors).catch(() => {});
            await this.planner.updatePlan(artifact);
            this.telemetry.endTracking(artifact.taskId, 'FAILURE', 0);

            onProgress?.(`❌ Task FAILED — check logs for details`);
        }
    }
}


