import { Logger } from '../utils/logger';

export interface ToolCallSignature {
  toolName: string;
  argsHash: string;
  timestamp: number;
}

export interface GuardIntervention {
  shouldHalt: boolean;
  warningPrompt?: string;
  reason?: 'duplicate_call_loop' | 'error_retry_exhausted' | 'excessive_turns';
}

export class ExecutionGuardService {
  private static instance: ExecutionGuardService;
  private readonly logger = Logger.getInstance();

  private callHistory: ToolCallSignature[] = [];
  private toolErrorCounts: Map<string, number> = new Map();
  private maxConsecutiveDuplicates = 3;
  private maxToolErrors = 3;

  public static getInstance(): ExecutionGuardService {
    if (!ExecutionGuardService.instance) {
      ExecutionGuardService.instance = new ExecutionGuardService();
    }
    return ExecutionGuardService.instance;
  }

  public reset(): void {
    this.callHistory = [];
    this.toolErrorCounts.clear();
  }

  /**
   * Evaluates if a tool execution should proceed or if an agent loop deadlock is detected.
   */
  public evaluatePreExecution(toolName: string, args: Record<string, any>): GuardIntervention {
    const argsStr = JSON.stringify(args || {});
    const argsHash = `${toolName}_${argsStr}`;
    const now = Date.now();

    // Check last N calls for exact duplicates
    const recentDuplicates = this.callHistory
      .slice(-this.maxConsecutiveDuplicates)
      .filter((c) => c.argsHash === argsHash);

    if (recentDuplicates.length >= this.maxConsecutiveDuplicates - 1) {
      this.logger.warn(`[ExecutionGuard] Loop detected: ${toolName} called with identical arguments ${recentDuplicates.length + 1} times!`);
      console.log(`\n[StrategyLoopGuard]\nRepeated strategy detected\nAction: BLOCK\n`);
      return {
        shouldHalt: false,
        reason: 'duplicate_call_loop',
        warningPrompt: `[GUARD REMINDER: LOOP HYGIENE] You have executed '${toolName}' with the exact same arguments ${recentDuplicates.length + 1} times in a row without making progress. Please stop repeating this call, analyze why the previous output was insufficient, adjust your strategy or ask the user.`
      };
    }

    this.callHistory.push({
      toolName,
      argsHash,
      timestamp: now
    });

    return { shouldHalt: false };
  }

  /**
   * Tracks tool errors and triggers self-healing interventions if a tool fails repeatedly.
   */
  public recordToolResult(toolName: string, success: boolean, errorMessage?: string): GuardIntervention {
    if (!success) {
      const currentErrors = (this.toolErrorCounts.get(toolName) || 0) + 1;
      this.toolErrorCounts.set(toolName, currentErrors);

      if (currentErrors >= this.maxToolErrors) {
        this.logger.warn(`[ExecutionGuard] Tool '${toolName}' failed ${currentErrors} times: ${errorMessage}`);
        return {
          shouldHalt: false,
          reason: 'error_retry_exhausted',
          warningPrompt: `[GUARD INTERVENTION] The tool '${toolName}' has failed ${currentErrors} times with error: "${errorMessage}". Do NOT attempt the same call again. Use an alternate tool, check file paths, or formulate a plan to fix the prerequisite.`
        };
      }
    } else {
      // Clear error streak on success
      this.toolErrorCounts.delete(toolName);
    }

    return { shouldHalt: false };
  }
}
