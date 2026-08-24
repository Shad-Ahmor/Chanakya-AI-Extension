import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../utils/logger';

export interface SelfLearningMetrics {
  coldRuns: number;
  coldSuccesses: number;
  warmRuns: number;
  warmSuccesses: number;
  totalToolCalls: number;
  totalToolFailures: number;
  loopsDetected: number;
  skillOptProposals: number;
  skillOptAcceptances: number;
  memoriesRetrieved: number;
  memoriesUseful: number;
  memoryCausedFailures: number;
  totalRetrievalLatencyMs: number;
  totalContextTokensAdded: number;
}

export class SelfLearningTelemetry {
  private static instance: SelfLearningTelemetry;
  private metricsPath: string;
  private metrics: SelfLearningMetrics;
  private logger = Logger.getInstance();

  private constructor(workspaceRoot: string) {
    const telemetryDir = path.join(workspaceRoot, '.agents', 'telemetry');
    if (!fs.existsSync(telemetryDir)) {
      fs.mkdirSync(telemetryDir, { recursive: true });
    }
    this.metricsPath = path.join(telemetryDir, 'self_learning_metrics.json');
    this.metrics = this.loadMetrics();
  }

  public static getInstance(workspaceRoot: string): SelfLearningTelemetry {
    if (!SelfLearningTelemetry.instance) {
      SelfLearningTelemetry.instance = new SelfLearningTelemetry(workspaceRoot);
    }
    return SelfLearningTelemetry.instance;
  }

  private loadMetrics(): SelfLearningMetrics {
    if (fs.existsSync(this.metricsPath)) {
      try {
        const data = fs.readFileSync(this.metricsPath, 'utf8');
        return JSON.parse(data) as SelfLearningMetrics;
      } catch (err) {
        this.logger.error('Failed to load self-learning metrics', err);
      }
    }
    return this.getDefaultMetrics();
  }

  private getDefaultMetrics(): SelfLearningMetrics {
    return {
      coldRuns: 0,
      coldSuccesses: 0,
      warmRuns: 0,
      warmSuccesses: 0,
      totalToolCalls: 0,
      totalToolFailures: 0,
      loopsDetected: 0,
      skillOptProposals: 0,
      skillOptAcceptances: 0,
      memoriesRetrieved: 0,
      memoriesUseful: 0,
      memoryCausedFailures: 0,
      totalRetrievalLatencyMs: 0,
      totalContextTokensAdded: 0
    };
  }

  public saveMetrics(): void {
    try {
      fs.writeFileSync(this.metricsPath, JSON.stringify(this.metrics, null, 2), 'utf8');
    } catch (err) {
      this.logger.error('Failed to save self-learning metrics', err);
    }
  }

  public getMetrics(): SelfLearningMetrics {
    return { ...this.metrics };
  }

  public logRun(type: 'cold' | 'warm', success: boolean) {
    if (type === 'cold') {
      this.metrics.coldRuns++;
      if (success) this.metrics.coldSuccesses++;
    } else {
      this.metrics.warmRuns++;
      if (success) this.metrics.warmSuccesses++;
    }
    this.saveMetrics();
  }

  public logToolCall(failed: boolean) {
    this.metrics.totalToolCalls++;
    if (failed) this.metrics.totalToolFailures++;
    this.saveMetrics();
  }

  public logLoopDetected() {
    this.metrics.loopsDetected++;
    this.saveMetrics();
  }

  public logSkillOpt(accepted: boolean) {
    this.metrics.skillOptProposals++;
    if (accepted) this.metrics.skillOptAcceptances++;
    this.saveMetrics();
  }

  public logMemoryRetrieval(latencyMs: number, tokensAdded: number, countRetrieved: number) {
    this.metrics.totalRetrievalLatencyMs += latencyMs;
    this.metrics.totalContextTokensAdded += tokensAdded;
    this.metrics.memoriesRetrieved += countRetrieved;
    this.saveMetrics();
  }

  public logMemoryOutcome(useful: boolean, causedFailure: boolean) {
    if (useful) this.metrics.memoriesUseful++;
    if (causedFailure) this.metrics.memoryCausedFailures++;
    this.saveMetrics();
  }

  public logTelemetrySummary() {
    this.logger.log(`[SELF-LEARNING METRICS]`);
    this.logger.log(`Cold Success: ${this.metrics.coldSuccesses}/${this.metrics.coldRuns}`);
    this.logger.log(`Warm Success: ${this.metrics.warmSuccesses}/${this.metrics.warmRuns}`);
    this.logger.log(`Tool Failures: ${this.metrics.totalToolFailures}/${this.metrics.totalToolCalls}`);
    this.logger.log(`Memory-Caused Failures: ${this.metrics.memoryCausedFailures}`);
    this.logger.log(`Memories Useful: ${this.metrics.memoriesUseful}/${this.metrics.memoriesRetrieved}`);
    const avgLatency = this.metrics.memoriesRetrieved > 0 ? (this.metrics.totalRetrievalLatencyMs / this.metrics.memoriesRetrieved).toFixed(1) : 0;
    this.logger.log(`Avg Retrieval Latency: ${avgLatency}ms`);
  }
}
