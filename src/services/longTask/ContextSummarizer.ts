import { Logger } from '../../utils/logger';
import { ContextBudgetManager } from './ContextBudgetManager';

export interface SummarizationResult {
    summary: string;
    compressionRatio: number;
    preservedEntities: string[];
}

export class ContextSummarizer {
    private readonly logger = Logger.getInstance();
    private readonly budgetManager = new ContextBudgetManager();

    // Patterns that must NEVER be removed from summaries
    private readonly criticalPatterns: RegExp[] = [
        /(?:error|exception|failed|crash):\s*.+/gi,
        /(?:file|path|module):\s*["']?[\w\/\\.]+["']?/gi,
        /(?:function|class|interface|export)\s+\w+/g,
        /REQ-\w+/g,
        /STEP-\w+/g,
        /(?:must|must not|constraint):\s*.+/gi,
    ];

    public summarizeToolOutput(toolOutput: string, maxTokens: number): SummarizationResult {
        const originalTokens = this.budgetManager.estimateTokens(toolOutput);

        if (originalTokens <= maxTokens) {
            return { summary: toolOutput, compressionRatio: 1.0, preservedEntities: [] };
        }

        const preservedEntities: string[] = [];
        for (const pattern of this.criticalPatterns) {
            const matches = toolOutput.match(pattern);
            if (matches) preservedEntities.push(...matches.slice(0, 20));
        }

        const entityBlock = preservedEntities.length > 0
            ? `=== PRESERVED ENTITIES ===\n${[...new Set(preservedEntities)].join('\n')}\n===\n\n`
            : '';

        const budgetChars = maxTokens * 4;
        const contentBudget = Math.max(0, budgetChars - entityBlock.length);
        const half = Math.floor(contentBudget / 2);

        const head = toolOutput.substring(0, half);
        const tail = toolOutput.substring(toolOutput.length - half);
        const note = `\n\n[...${originalTokens - maxTokens} tokens compressed...]\n\n`;
        const summary = entityBlock + head + note + tail;

        this.logger.log(`[ContextSummarizer] Compressed: ${originalTokens} → ${this.budgetManager.estimateTokens(summary)} tokens`);

        return {
            summary,
            compressionRatio: this.budgetManager.estimateTokens(summary) / originalTokens,
            preservedEntities: [...new Set(preservedEntities)]
        };
    }

    public buildStepSummary(stepId: string, observations: string[], toolResults: string[]): string {
        const lines: string[] = [`=== STEP ${stepId} SUMMARY ===`];
        if (observations.length > 0) {
            lines.push('Observations:');
            observations.slice(-5).forEach(o => lines.push(`  - ${o}`));
        }
        if (toolResults.length > 0) {
            lines.push('Key Tool Results:');
            toolResults.forEach(r => {
                const compact = r.length > 500 ? r.substring(0, 200) + '...' + r.substring(r.length - 200) : r;
                lines.push(`  ${compact}`);
            });
        }
        lines.push(`=== END STEP ${stepId} ===`);
        return lines.join('\n');
    }

    public buildPhaseSummary(phaseId: string, stepSummaries: string[]): string {
        const combined = stepSummaries.join('\n');
        const tokens = this.budgetManager.estimateTokens(combined);
        if (tokens < 2000) return `=== PHASE ${phaseId} ===\n${combined}\n=== END PHASE ===`;
        const first = stepSummaries[0] || '';
        const last = stepSummaries[stepSummaries.length - 1] || '';
        return `=== PHASE ${phaseId} (${stepSummaries.length} steps, compressed) ===\n${first}\n[...${stepSummaries.length - 2} intermediate steps...]\n${last}\n=== END PHASE ===`;
    }
}

