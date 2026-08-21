"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationGate = void 0;
var ValidationGate = /** @class */ (function () {
    function ValidationGate() {
    }
    ValidationGate.getInstance = function () {
        if (!ValidationGate.instance) {
            ValidationGate.instance = new ValidationGate();
        }
        return ValidationGate.instance;
    };
    ValidationGate.prototype.evaluateDecision = function (currentScore, candidateScore, minimumImprovement) {
        if (minimumImprovement === void 0) { minimumImprovement = 0.02; }
        var improvement = candidateScore - currentScore;
        var normalizedImprovement = Number(improvement.toFixed(4));
        if (normalizedImprovement >= minimumImprovement) {
            return {
                decision: 'accepted',
                currentScore: currentScore,
                candidateScore: candidateScore,
                improvement: normalizedImprovement,
                reason: "Candidate accepted. Improvement of ".concat(normalizedImprovement, " meets or exceeds the minimum threshold of ").concat(minimumImprovement, ".")
            };
        }
        else if (normalizedImprovement > 0) {
            return {
                decision: 'rejected',
                currentScore: currentScore,
                candidateScore: candidateScore,
                improvement: normalizedImprovement,
                reason: "Candidate rejected. Improvement of ".concat(normalizedImprovement, " is below the minimum threshold of ").concat(minimumImprovement, ".")
            };
        }
        else {
            return {
                decision: 'rejected',
                currentScore: currentScore,
                candidateScore: candidateScore,
                improvement: normalizedImprovement,
                reason: "Candidate rejected. Score regressed or showed zero improvement (".concat(normalizedImprovement, ").")
            };
        }
    };
    return ValidationGate;
}());
exports.ValidationGate = ValidationGate;
