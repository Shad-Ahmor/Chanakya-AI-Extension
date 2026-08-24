import { Logger } from '../../utils/logger';

export interface LongTaskMetrics {
    taskId: string;
    taskDurationMs: number;
    planningDurationMs: number;
    planningTokens: number;
    executionTokens: number;
    contextCompressionCount: number;
    contextRetrievalLatencyMs: number;
    memoryRetrievalCount: number;
    memoryInfluenceCount: number;
    toolCalls: number;
    toolFailures: number;
    retries: number;
    planRevisions: number;
    checkpointCount: number;
    recoveryEvents: number;
    successfulSteps: number;
    failedSteps: number;
    finalOutcome: 'SUCCESS' | 'FAILURE' | 'CANCELLED';
    planAccuracy: number;
    requirementCoverage: number;
    contextCompressionRatio: number;
}

export class LongTaskTelemetry {
    private readonly logger = Logger.getInstance();
    private activeMetrics = new Map<string, Partial<LongTaskMetrics>>();

    public startTracking(taskId: string) {
        this.activeMetrics.set(taskId, {
            taskId,
            taskDurationMs: Date.now(),
            planningTokens: 0,
            executionTokens: 0,
            contextCompressionCount: 0,
            contextRetrievalLatencyMs: 0,
            memoryRetrievalCount: 0,
            memoryInfluenceCount: 0,
            toolCalls: 0,
            toolFailures: 0,
            retries: 0,
            planRevisions: 0,
            checkpointCount: 0,
            recoveryEvents: 0,
            successfulSteps: 0,
            failedSteps: 0
        });
    }

    public recordEvent(taskId: string, event: keyof LongTaskMetrics, value: number = 1) {
        const metrics = this.activeMetrics.get(taskId);
        if (metrics) {
            // @ts-ignore
            metrics[event] = (metrics[event] || 0) + value;
        }
    }

    public endTracking(taskId: string, outcome: 'SUCCESS' | 'FAILURE' | 'CANCELLED', coverage: number) {
        const metrics = this.activeMetrics.get(taskId);
        if (metrics) {
            metrics.finalOutcome = outcome;
            metrics.requirementCoverage = coverage;
            metrics.taskDurationMs = Date.now() - (metrics.taskDurationMs || 0);

            // In real app, emit to central telemetry store / selfLearningTelemetry
            this.logger.log(`[LongTaskTelemetry] Final Metrics for ${taskId}:`, JSON.stringify(metrics, null, 2));
            this.activeMetrics.delete(taskId);
        }
    }
}
