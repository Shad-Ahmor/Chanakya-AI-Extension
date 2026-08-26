import { ComplexityScore, TaskComplexity } from './types';

export class TaskComplexityDetector {
    constructor(_config: any) {
        // config not used in current scoring
    }

    public detect(prompt: string): ComplexityScore {
        const charCount = prompt.length;
        
        let lineCount = 1;
        for (let i = 0; i < charCount; i++) {
            if (prompt[i] === '\n') lineCount++;
        }
        
        const tokenPressure = Math.ceil(charCount / 4);
        const regexTarget = prompt.length > 10000 ? prompt.substring(0, 10000) : prompt;

        const codeBlocks = (regexTarget.match(/```/g) || []).length / 2;
        const fileReferences = (regexTarget.match(/[\w-]+\.(ts|js|tsx|jsx|json|md|py|go|rs|java|cpp|c|h)/g) || []).length;
        const explicitRequirements = (regexTarget.match(/(must|should|require|need to|make sure)/gi) || []).length;
        const constraints = (regexTarget.match(/(must not|do not|don't|never|avoid)/gi) || []).length;
        const requestedOperations = (regexTarget.match(/(create|update|delete|modify|refactor|build|implement|fix)/gi) || []).length;
        
        const massiveScopeKeywords = (regexTarget.match(/(entire repository|comprehensive|deep analysis|massive|all files|architecture review|end-to-end|every file|phase [0-9]+|step [0-9]+)/gi) || []).length;
        const mcpRequirements = (regexTarget.match(/(mcp|tool|database|postgres|server|client|api)/gi) || []).length;

        // Base score calculation on a 0-10+ scale
        let totalScore = 0;
        
        if (tokenPressure > 2000) totalScore += 2;
        else if (tokenPressure > 500) totalScore += 1;
        
        if (explicitRequirements > 3) totalScore += 1;
        if (fileReferences > 3) totalScore += 1;
        if (codeBlocks > 2) totalScore += 1;
        if (constraints > 0) totalScore += 1;
        if (requestedOperations > 3) totalScore += 1;
        
        if (massiveScopeKeywords > 0) totalScore += 3;
        if (mcpRequirements > 0) totalScore += 2;
        
        if (lineCount > 100) totalScore += 2;
        else if (lineCount > 30) totalScore += 1;

        let classification = TaskComplexity.SMALL; // 0-2 (SIMPLE)

        if (totalScore >= 9) {
            classification = TaskComplexity.EXTREME; // 9+ (DEEP AGENT MODE)
        } else if (totalScore >= 6) {
            classification = TaskComplexity.LARGE; // 6-8 (COMPLEX)
        } else if (totalScore >= 3) {
            classification = TaskComplexity.MEDIUM; // 3-5 (MODERATE)
        }

        return {
            tokenPressure,
            requirementCount: explicitRequirements + constraints,
            fileCount: fileReferences,
            dependencyDepth: 0,
            operationCount: requestedOperations,
            ambiguity: 0,
            expectedToolCalls: Math.max(1, Math.floor(totalScore)),
            classification
        };
    }
}
