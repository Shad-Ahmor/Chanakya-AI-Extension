export interface ValidationDecision {
    decision: 'accepted' | 'rejected';
    currentScore: number;
    candidateScore: number;
    improvement: number;
    reason: string;
}

export class ValidationGate {
    private static instance: ValidationGate;

    private constructor() {}

    public static getInstance(): ValidationGate {
        if (!ValidationGate.instance) {
            ValidationGate.instance = new ValidationGate();
        }
        return ValidationGate.instance;
    }

    public evaluateDecision(currentScore: number, candidateScore: number): ValidationDecision {
        // Strict improvement check
        if (candidateScore > currentScore) {
            const improvement = candidateScore - currentScore;
            return {
                decision: 'accepted',
                currentScore,
                candidateScore,
                improvement: Number(improvement.toFixed(4)),
                reason: `Candidate accepted. Strictly improved from ${currentScore} to ${candidateScore}.`
            };
        } else {
            const regression = currentScore - candidateScore;
            return {
                decision: 'rejected',
                currentScore,
                candidateScore,
                improvement: regression === 0 ? 0 : -Number(regression.toFixed(4)),
                reason: `Candidate rejected. Score did not strictly improve (Candidate: ${candidateScore}, Current: ${currentScore}).`
            };
        }
    }
}
