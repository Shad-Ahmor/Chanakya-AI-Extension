import { Logger } from '../utils/logger';

export interface PxPipeEventLog {
  id: string;
  timestamp: number;
  modelId: string;
  contextType: 'system_prompt' | 'mcp_schemas' | 'chat_history' | 'file_dump';
  charCount: number;
  counterfactualTextTokens: number;
  actualImageTokens: number;
  savedTokens: number;
  savingsUsd: number;
  savingsRatio: number;
}

export interface PxPipeTelemetry {
  totalCompressions: number;
  totalCharsImaged: number;
  counterfactualTextTokens: number;
  actualImageTokensUsed: number;
  lifetimeSavedTokens: number;
  lifetimeSavedUsd: number;
  averageSavingsRatio: number;
}

export class PxPipeTracker {
  private static instance: PxPipeTracker;
  private logger = Logger.getInstance();
  private events: PxPipeEventLog[] = [];
  private readonly maxEvents = 100;

  private constructor() {}

  public static getInstance(): PxPipeTracker {
    if (!PxPipeTracker.instance) {
      PxPipeTracker.instance = new PxPipeTracker();
    }
    return PxPipeTracker.instance;
  }

  /**
   * Record a PxPipe compression event
   */
  public recordEvent(event: Omit<PxPipeEventLog, 'id' | 'timestamp'>): PxPipeEventLog {
    const fullEvent: PxPipeEventLog = {
      ...event,
      id: `px_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now()
    };

    this.events.unshift(fullEvent);
    if (this.events.length > this.maxEvents) {
      this.events.pop();
    }

    this.logger.log(
      `[PxPipeTracker] Recorded compression: ${event.charCount} chars, saved ${event.savedTokens} tokens (${event.savingsRatio}%), +$${event.savingsUsd.toFixed(4)}`
    );

    return fullEvent;
  }

  /**
   * Get aggregated telemetry metrics
   */
  public getTelemetry(): PxPipeTelemetry {
    const totalCompressions = this.events.length;
    let totalCharsImaged = 0;
    let counterfactualTextTokens = 0;
    let actualImageTokensUsed = 0;
    let lifetimeSavedTokens = 0;
    let lifetimeSavedUsd = 0;

    for (const ev of this.events) {
      totalCharsImaged += ev.charCount;
      counterfactualTextTokens += ev.counterfactualTextTokens;
      actualImageTokensUsed += ev.actualImageTokens;
      lifetimeSavedTokens += ev.savedTokens;
      lifetimeSavedUsd += ev.savingsUsd;
    }

    const averageSavingsRatio =
      counterfactualTextTokens > 0
        ? Math.round((lifetimeSavedTokens / counterfactualTextTokens) * 100)
        : 0;

    return {
      totalCompressions,
      totalCharsImaged,
      counterfactualTextTokens,
      actualImageTokensUsed,
      lifetimeSavedTokens,
      lifetimeSavedUsd,
      averageSavingsRatio
    };
  }

  /**
   * Get recent event history
   */
  public getRecentEvents(limit = 40): PxPipeEventLog[] {
    return this.events.slice(0, limit);
  }
}
