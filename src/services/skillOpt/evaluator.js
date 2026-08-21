"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvaluatorFactory = exports.BaseTrajectoryEvaluator = void 0;
class BaseTrajectoryEvaluator {
    evaluate(trajectory) {
        let score = 0;
        let reasons = [];
        // 1. Task Completion (Weight: 50%)
        if (trajectory.success) {
            score += 50;
            reasons.push("Task completed successfully.");
        }
        else {
            reasons.push("Task failed.");
        }
        // 2. Tool Calls (Weight: up to 50%)
        let toolScore = 0;
        if (trajectory.toolCalls.length > 0) {
            let successCount = 0;
            let errorCount = 0;
            for (const call of trajectory.toolCalls) {
                if (call.success) {
                    successCount++;
                }
                else {
                    errorCount++;
                }
            }
            // Ratio of successful tools
            const toolSuccessRatio = successCount / trajectory.toolCalls.length;
            toolScore = toolSuccessRatio * 50;
            if (errorCount > 0) {
                reasons.push(`${errorCount} MCP tool call(s) failed.`);
                // Deduct flat penalty for errors
                toolScore -= (errorCount * 5);
            }
        }
        else {
            // If no tools were called but task succeeded, give full tool score.
            if (trajectory.success) {
                toolScore = 50;
            }
        }
        // 3. Retries Penalty
        if (trajectory.retries > 0) {
            const retryPenalty = trajectory.retries * 10;
            toolScore -= retryPenalty;
            reasons.push(`Required ${trajectory.retries} retries.`);
        }
        score += Math.max(0, toolScore); // Don't let tool score drop below 0
        // Clamp total score
        score = Math.max(0, Math.min(100, score));
        // Normalize to 0.0 - 1.0 range
        const normalizedScore = Number((score / 100).toFixed(2));
        const result = {
            success: normalizedScore >= 0.7 && trajectory.success,
            score: normalizedScore,
            reason: reasons.join(' ').trim()
        };
        return result;
    }
}
exports.BaseTrajectoryEvaluator = BaseTrajectoryEvaluator;
class EvaluatorFactory {
    static getEvaluator() {
        return new BaseTrajectoryEvaluator();
    }
}
exports.EvaluatorFactory = EvaluatorFactory;
//# sourceMappingURL=evaluator.js.map