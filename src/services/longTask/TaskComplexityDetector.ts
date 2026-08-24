import { ComplexityScore, TaskComplexity } from './types';

export class TaskComplexityDetector {
    private config: {
        mediumThreshold: number;
        largeThreshold: number;
        veryLargeThreshold: number;
        extremeThreshold: number;
    };

    constructor(config: any) {
        this.config = {
            mediumThreshold: config.longTask?.mediumThreshold || 20,
            largeThreshold: config.longTask?.largeThreshold || 50,
            veryLargeThreshold: config.longTask?.veryLargeThreshold || 100,
            extremeThreshold: config.longTask?.extremeThreshold || 200
        };
    }

    public detect(prompt: string): ComplexityScore {
        const charCount = prompt.length;
        const lineCount = prompt.split('\n').length;
        
        // Estimate token pressure (roughly 4 chars per token)
        const tokenPressure = Math.ceil(charCount / 4);

        // Simple heuristics
        const codeBlocks = (prompt.match(/```/g) || []).length / 2;
        const fileReferences = (prompt.match(/[\w-]+\.(ts|js|tsx|jsx|json|md|py|go|rs|java|cpp|c|h)/g) || []).length;
        const explicitRequirements = (prompt.match(/(must|should|require|need to|make sure)/gi) || []).length;
        const constraints = (prompt.match(/(must not|do not|don't|never|avoid)/gi) || []).length;
        const requestedOperations = (prompt.match(/(create|update|delete|modify|refactor|build|implement|fix)/gi) || []).length;

        // Base score calculation
        let totalScore = 0;
        
        // 1 point per 500 estimated tokens
        totalScore += Math.floor(tokenPressure / 500);
        
        totalScore += explicitRequirements * 2;
        totalScore += fileReferences * 2;
        totalScore += codeBlocks * 3;
        totalScore += constraints * 3;
        totalScore += requestedOperations;
        
        // Add line count weight (1 point per 50 lines)
        totalScore += Math.floor(lineCount / 50);

        let classification = TaskComplexity.SMALL;

        if (totalScore >= this.config.extremeThreshold) {
            classification = TaskComplexity.EXTREME;
        } else if (totalScore >= this.config.veryLargeThreshold) {
            classification = TaskComplexity.VERY_LARGE;
        } else if (totalScore >= this.config.largeThreshold) {
            classification = TaskComplexity.LARGE;
        } else if (totalScore >= this.config.mediumThreshold) {
            classification = TaskComplexity.MEDIUM;
        }

        return {
            tokenPressure,
            requirementCount: explicitRequirements + constraints,
            fileCount: fileReferences,
            dependencyDepth: 0, // Computed later during ingestion
            operationCount: requestedOperations,
            ambiguity: 0, // Computed later
            expectedToolCalls: Math.max(1, Math.floor(totalScore / 5)), // Rough estimate
            classification
        };
    }
}
