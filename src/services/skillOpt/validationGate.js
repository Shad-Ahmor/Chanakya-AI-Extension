"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationGate = void 0;
class ValidationGate {
    static instance;
    constructor() { }
    static getInstance() {
        if (!ValidationGate.instance) {
            ValidationGate.instance = new ValidationGate();
        }
        return ValidationGate.instance;
    }
    evaluateDecision(currentScore, candidateScore, minimumImprovement = 0.02) {
        const improvement = candidateScore - currentScore;
        const normalizedImprovement = Number(improvement.toFixed(4));
        if (normalizedImprovement >= minimumImprovement) {
            return {
                decision: 'accepted',
                currentScore,
                candidateScore,
                improvement: normalizedImprovement,
                reason: `Candidate accepted. Improvement of ${normalizedImprovement} meets or exceeds the minimum threshold of ${minimumImprovement}.`
            };
        }
        else if (normalizedImprovement > 0) {
            return {
                decision: 'rejected',
                currentScore,
                candidateScore,
                improvement: normalizedImprovement,
                reason: `Candidate rejected. Improvement of ${normalizedImprovement} is below the minimum threshold of ${minimumImprovement}.`
            };
        }
        else {
            return {
                decision: 'rejected',
                currentScore,
                candidateScore,
                improvement: normalizedImprovement,
                reason: `Candidate rejected. Score regressed or showed zero improvement (${normalizedImprovement}).`
            };
        }
    }
}
exports.ValidationGate = ValidationGate;
//# sourceMappingURL=validationGate.js.map