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
        
        // Count lines safely without allocating a huge array
        let lineCount = 1;
        for (let i = 0; i < charCount; i++) {
            if (prompt[i] === '\n') lineCount++;
        }
        
        // Estimate token pressure (roughly 4 chars per token)
        const tokenPressure = Math.ceil(charCount / 4);

        // To prevent V8 Regex engine crashes on million-line prompts, limit semantic scanning to first 10,000 characters
        const regexTarget = prompt.length > 10000 ? prompt.substring(0, 10000) : prompt;

        // Simple heuristics
        const codeBlocks = (regexTarget.match(/```/g) || []).length / 2;
        const fileReferences = (regexTarget.match(/[\w-]+\.(ts|js|tsx|jsx|json|md|py|go|rs|java|cpp|c|h)/g) || []).length;
        const explicitRequirements = (regexTarget.match(/(must|should|require|need to|make sure)/gi) || []).length;
        const constraints = (regexTarget.match(/(must not|do not|don't|never|avoid)/gi) || []).length;
        const requestedOperations = (regexTarget.match(/(create|update|delete|modify|refactor|build|implement|fix)/gi) || []).length;
        
        // Semantic horizon triggers (detecting deceptively short but massive tasks)
        const massiveScopeKeywords = (regexTarget.match(/(entire repository|comprehensive|deep analysis|massive|all files|architecture review|end-to-end|every file|phase [0-9]+|step [0-9]+)/gi) || []).length;

        // Base score calculation
        let totalScore = 0;
        
        // 1 point per 500 estimated tokens
        totalScore += Math.floor(tokenPressure / 500);
        
        totalScore += explicitRequirements * 2;
        totalScore += fileReferences * 2;
        totalScore += codeBlocks * 3;
        totalScore += constraints * 3;
        totalScore += requestedOperations;
        
        // Semantic scope heavily weights the task towards LongTaskManager
        totalScore += massiveScopeKeywords * 15;
        
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
