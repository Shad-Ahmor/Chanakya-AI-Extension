"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionGuardService = void 0;
const logger_1 = require("../utils/logger");
class ExecutionGuardService {
    static instance;
    logger = logger_1.Logger.getInstance();
    callHistory = [];
    toolErrorCounts = new Map();
    maxConsecutiveDuplicates = 3;
    maxToolErrors = 3;
    static getInstance() {
        if (!ExecutionGuardService.instance) {
            ExecutionGuardService.instance = new ExecutionGuardService();
        }
        return ExecutionGuardService.instance;
    }
    reset() {
        this.callHistory = [];
        this.toolErrorCounts.clear();
    }
    /**
     * Evaluates if a tool execution should proceed or if an agent loop deadlock is detected.
     */
    evaluatePreExecution(toolName, args) {
        const argsStr = JSON.stringify(args || {});
        const argsHash = `${toolName}_${argsStr}`;
        const now = Date.now();
        // Check last N calls for exact duplicates
        const recentDuplicates = this.callHistory
            .slice(-this.maxConsecutiveDuplicates)
            .filter((c) => c.argsHash === argsHash);
        if (recentDuplicates.length >= this.maxConsecutiveDuplicates - 1) {
            this.logger.warn(`[ExecutionGuard] Loop detected: ${toolName} called with identical arguments ${recentDuplicates.length + 1} times!`);
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
    recordToolResult(toolName, success, errorMessage) {
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
        }
        else {
            // Clear error streak on success
            this.toolErrorCounts.delete(toolName);
        }
        return { shouldHalt: false };
    }
}
exports.ExecutionGuardService = ExecutionGuardService;
//# sourceMappingURL=executionGuard.js.map