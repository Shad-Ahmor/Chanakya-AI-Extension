"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvaluatorFactory = exports.BaseTrajectoryEvaluator = void 0;
var BaseTrajectoryEvaluator = /** @class */ (function () {
    function BaseTrajectoryEvaluator() {
    }
    BaseTrajectoryEvaluator.prototype.evaluate = function (trajectory) {
        var score = 0;
        var reasons = [];
        // 1. Task Completion (Weight: 50%)
        if (trajectory.success) {
            score += 50;
            reasons.push("Task completed successfully.");
        }
        else {
            reasons.push("Task failed.");
        }
        // 2. Tool Calls (Weight: up to 50%)
        var toolScore = 0;
        if (trajectory.toolCalls.length > 0) {
            var successCount = 0;
            var errorCount = 0;
            for (var _i = 0, _a = trajectory.toolCalls; _i < _a.length; _i++) {
                var call = _a[_i];
                if (call.success) {
                    successCount++;
                }
                else {
                    errorCount++;
                }
            }
            // Ratio of successful tools
            var toolSuccessRatio = successCount / trajectory.toolCalls.length;
            toolScore = toolSuccessRatio * 50;
            if (errorCount > 0) {
                reasons.push("".concat(errorCount, " MCP tool call(s) failed."));
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
            var retryPenalty = trajectory.retries * 10;
            toolScore -= retryPenalty;
            reasons.push("Required ".concat(trajectory.retries, " retries."));
        }
        score += Math.max(0, toolScore); // Don't let tool score drop below 0
        // Clamp total score
        score = Math.max(0, Math.min(100, score));
        // Normalize to 0.0 - 1.0 range
        var normalizedScore = Number((score / 100).toFixed(2));
        var result = {
            success: normalizedScore >= 0.7 && trajectory.success,
            score: normalizedScore,
            reason: reasons.join(' ').trim()
        };
        return result;
    };
    return BaseTrajectoryEvaluator;
}());
exports.BaseTrajectoryEvaluator = BaseTrajectoryEvaluator;
var EvaluatorFactory = /** @class */ (function () {
    function EvaluatorFactory() {
    }
    EvaluatorFactory.getEvaluator = function (type) {
        if (type === void 0) { type = 'default'; }
        return new BaseTrajectoryEvaluator();
    };
    return EvaluatorFactory;
}());
exports.EvaluatorFactory = EvaluatorFactory;
