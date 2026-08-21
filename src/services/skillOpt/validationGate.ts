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

    public evaluateDecision(currentScore: number, candidateScore: number, minimumImprovement: number = 0.02): ValidationDecision {
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
        } else if (normalizedImprovement > 0) {
            return {
                decision: 'rejected',
                currentScore,
                candidateScore,
                improvement: normalizedImprovement,
                reason: `Candidate rejected. Improvement of ${normalizedImprovement} is below the minimum threshold of ${minimumImprovement}.`
            };
        } else {
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
