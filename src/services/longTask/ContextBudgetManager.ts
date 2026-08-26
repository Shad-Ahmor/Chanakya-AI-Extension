import { TaskComplexity } from './types';

export interface ContextBudget {
    maxTotalTokens: number;
    systemTokens: number;
    planTokens: number;
    requirementTokens: number;
    memoryTokens: number;
    codeTokens: number;
    observationTokens: number;
    reservedOutputTokens: number;
}

export type ContextPhase = 'DISCOVERY' | 'DESIGN' | 'IMPLEMENTATION' | 'TESTING' | 'VERIFICATION';

export class ContextBudgetManager {

    /**
     * Dynamically calculates context budget based on model limit, task complexity, and current phase.
     * This prevents any single category from monopolizing the context window.
     */
    public calculateBudget(
        modelContextLimit: number,
        complexity: TaskComplexity,
        phase: ContextPhase,
        sizes: {
            toolOutputSize?: number;
            codeSize?: number;
            planSize?: number;
            memorySize?: number;
        }
    ): ContextBudget {
        // Reserve a safety margin (10%) and output buffer
        const safeLimit = Math.floor(modelContextLimit * 0.9);
        const outputReserve = Math.min(8192, Math.floor(safeLimit * 0.15));
        const available = safeLimit - outputReserve;

        // Phase-specific allocation ratios
        let ratios: Record<string, number>;
        switch (phase) {
            case 'DISCOVERY':
                ratios = { system: 0.05, plan: 0.15, requirements: 0.20, memory: 0.20, code: 0.25, observations: 0.15 };
                break;
            case 'IMPLEMENTATION':
                ratios = { system: 0.05, plan: 0.10, requirements: 0.10, memory: 0.15, code: 0.45, observations: 0.15 };
                break;
            case 'TESTING':
                ratios = { system: 0.05, plan: 0.10, requirements: 0.15, memory: 0.10, code: 0.35, observations: 0.25 };
                break;
            case 'VERIFICATION':
                ratios = { system: 0.05, plan: 0.10, requirements: 0.20, memory: 0.15, code: 0.25, observations: 0.25 };
                break;
            default: // DESIGN
                ratios = { system: 0.05, plan: 0.20, requirements: 0.25, memory: 0.20, code: 0.20, observations: 0.10 };
        }

        // Complexity penalty — extreme tasks get tighter code budget to fit more requirements
        const complexityFactor = complexity === TaskComplexity.EXTREME ? 0.85 : 1.0;

        const budget: ContextBudget = {
            maxTotalTokens: safeLimit,
            reservedOutputTokens: outputReserve,
            systemTokens: Math.floor(available * ratios.system),
            planTokens: Math.floor(available * ratios.plan),
            requirementTokens: Math.floor(available * ratios.requirements),
            memoryTokens: Math.floor(available * ratios.memory),
            codeTokens: Math.floor(available * ratios.code * complexityFactor),
            observationTokens: Math.floor(available * ratios.observations),
        };

        // Dynamic adjustment: if actual sizes are smaller, reallocate slack to code
        const actualMemoryNeed = sizes.memorySize || 0;
        const slack = Math.max(0, budget.memoryTokens - actualMemoryNeed);
        if (slack > 0) {
            budget.memoryTokens = actualMemoryNeed;
            budget.codeTokens += Math.floor(slack * 0.7); // give 70% of slack to code
        }

        return budget;
    }

    public checkPressure(currentUsage: number, categoryLimit: number): 'OK' | 'WARNING' | 'EXCEEDED' {
        if (currentUsage > categoryLimit) return 'EXCEEDED';
        if (currentUsage > categoryLimit * 0.8) return 'WARNING';
        return 'OK';
    }

    public estimateTokens(text: string): number {
        // ~4 chars per token is a standard approximation
        return Math.ceil(text.length / 4);
    }

    /**
     * Truncates text to fit within a token budget, preserving the end of the text
     * (most recent content is usually more relevant).
     */
    public truncateToFit(text: string, maxTokens: number): string {
        const maxChars = maxTokens * 4;
        if (text.length <= maxChars) return text;
        return `[...truncated ${text.length - maxChars} chars...]\n` + text.substring(text.length - maxChars);
    }

    // --- Discovery Budget & File Read Validation ---
    
    private discoveryBudget = {
        searchesUsed: 0,
        filesRead: 0,
        unrelatedFilesRead: 0
    };

    public getDiscoveryBudget(complexity: TaskComplexity) {
        const base = {
            maxSearches: 3,
            maxFilesInitiallyRead: 5,
            maxLinesInitiallyRead: 500,
            maxUnrelatedFiles: 2
        };
        if (complexity === TaskComplexity.EXTREME || complexity === TaskComplexity.VERY_LARGE) {
            base.maxSearches = 10;
            base.maxFilesInitiallyRead = 15;
            base.maxLinesInitiallyRead = 1500;
        }
        return base;
    }

    public resetDiscoveryTracking() {
        this.discoveryBudget = { searchesUsed: 0, filesRead: 0, unrelatedFilesRead: 0 };
    }

    public validateFileRead(filePath: string, reason: string | undefined, planFiles: string[], complexity: TaskComplexity): { allowed: boolean; reason?: string } {
        if (!reason || reason.trim().length < 10) {
            return { allowed: false, reason: 'File read blocked: You must provide a substantive explicit reason for reading this file.' };
        }
        
        const budget = this.getDiscoveryBudget(complexity);
        
        if (this.discoveryBudget.filesRead >= budget.maxFilesInitiallyRead) {
            return { allowed: false, reason: `File read blocked: Discovery budget exhausted (${budget.maxFilesInitiallyRead} files). Please rely on the existing plan or replan.` };
        }
        
        const isRelated = planFiles.some(f => filePath.includes(f));
        if (!isRelated) {
            this.discoveryBudget.unrelatedFilesRead++;
            if (this.discoveryBudget.unrelatedFilesRead > budget.maxUnrelatedFiles) {
                return { allowed: false, reason: `File read blocked: Too many unrelated files accessed (${budget.maxUnrelatedFiles}). Stick to the implementation plan.` };
            }
        }
        
        this.discoveryBudget.filesRead++;
        return { allowed: true };
    }
}
