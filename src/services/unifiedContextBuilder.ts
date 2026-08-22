import { ContextItem } from '../types/ipc';
import { SkillRegistry } from './skillOpt/skillRegistry';
import { RulesRegistry } from './rulesEngine/rulesRegistry';
import { RagRetriever } from './ragRetriever';
import { Logger } from '../utils/logger';
import { TaskRoutingInfo } from './taskUnderstander';

export interface ContextBuildResult {
    systemPrompt: string;
    userPrompt: string;
    diagnostics: {
        rulesCount: number;
        skillsCount: number;
        ragChunksCount: number;
        mcpResultsCount: number;
        estimatedTokens: number;
    };
}

export interface ContextBuilderParams {
    prompt: string;
    workspaceRoot: string;
    baseSystemPrompt: string;
    optimizerConfig?: TaskRoutingInfo | any;
    contextItems: ContextItem[];
    existingMessages?: any[];
}

export class UnifiedContextBuilder {
    private static instance: UnifiedContextBuilder;
    private readonly logger = Logger.getInstance();
    
    // Limits
    private readonly MAX_RAG_CHUNKS = 5;
    private readonly MAX_SKILL_TOKENS = 2000;
    private readonly MAX_MCP_RESULT_HISTORY = 10;
    
    private constructor() {}

    public static getInstance(): UnifiedContextBuilder {
        if (!UnifiedContextBuilder.instance) {
            UnifiedContextBuilder.instance = new UnifiedContextBuilder();
        }
        return UnifiedContextBuilder.instance;
    }

    private estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }

    public async buildContext(params: ContextBuilderParams): Promise<ContextBuildResult> {
        const diagnostics = {
            rulesCount: 0,
            skillsCount: 0,
            ragChunksCount: 0,
            mcpResultsCount: 0,
            estimatedTokens: 0
        };

        let systemContent = params.baseSystemPrompt + '\n\n';
        let userContent = '';

        // 2. Rules (Highest Priority)
        if (params.optimizerConfig?.needsRules) {
            try {
                const rulesRegistry = RulesRegistry.getInstance(params.workspaceRoot);
                const enabledRules = rulesRegistry.listEnabledRules();
                if (enabledRules.length > 0) {
                    diagnostics.rulesCount = enabledRules.length;
                    const rulesText = enabledRules.map(r => `[RULE ${r.id}: ${r.name}]\n${r.content}`).join('\n\n');
                    systemContent += `--- System Rules (CRITICAL Constraints) ---\n${rulesText}\n\n`;
                }
            } catch (e) {
                this.logger.warn('Failed to load rules: ' + e);
            }
        }

        // 3. SkillOps
        if (params.optimizerConfig?.needsSkillOps) {
            try {
                const registry = SkillRegistry.getInstance(params.workspaceRoot);
                const allCategories = registry.listSkills();
                let skillOpsText = '';
                
                for (const category of allCategories) {
                    const best = registry.getBestSkill(category);
                    if (best) {
                        const newSkillText = `[ACTIVE SKILL: ${category} v${best.metadata.version}]\n${best.content}\n[/ACTIVE SKILL]\n\n`;
                        // Prevent Skill context explosion
                        if (this.estimateTokens(skillOpsText + newSkillText) <= this.MAX_SKILL_TOKENS) {
                            skillOpsText += newSkillText;
                            diagnostics.skillsCount++;
                        } else {
                            this.logger.warn(`SkillOps limit reached. Truncated skill: ${category}`);
                        }
                    }
                }
                if (skillOpsText) {
                    systemContent += `--- SkillOps Active Rules ---\n${skillOpsText.trim()}\n\n`;
                }
            } catch (e) {
                this.logger.warn('Failed to load active skills for SkillOps: ' + e);
            }
        }

        // 4. RAG Context (Codebase search results)
        if (params.optimizerConfig?.needsRAG) {
            try {
                const ragRetriever = RagRetriever.getInstance();
                const ragChunks = await ragRetriever.retrieve(params.prompt, this.MAX_RAG_CHUNKS, 0.7);
                if (ragChunks.length > 0) {
                    diagnostics.ragChunksCount = ragChunks.length;
                    let contextBlock = '--- RAG Codebase Context ---\n';
                    for (const r of ragChunks) {
                        contextBlock += `[File: ${r.chunk.filename} (Score: ${r.score.toFixed(2)})]\n\`\`\`\n${r.chunk.content}\n\`\`\`\n\n`;
                    }
                    contextBlock += '--- End of RAG Context ---\n\n';
                    userContent += contextBlock;
                }
            } catch (err) {
                this.logger.error('Failed to inject RAG Codebase Context', err);
            }
        }

        // 5. MCP Tool Information / Results
        // Note: Actual MCP execution historical results are embedded in existingMessages.
        // We count them here for diagnostics, and potentially limit history size if handled upstream.
        if (params.optimizerConfig?.needsMCP && params.existingMessages) {
            let mcpResults = params.existingMessages.filter(m => m.role === 'tool' || (m.role === 'user' && m.name));
            diagnostics.mcpResultsCount = Math.min(mcpResults.length, this.MAX_MCP_RESULT_HISTORY);
            // In a fully unified system, we might truncate existing messages here, but to avoid mutating history,
            // we rely on TokenOptimizer downstream. However, we acknowledge MCP results mathematically.
        }

        // 6. User Task (Context Items + Prompt)
        if (params.contextItems.length > 0) {
            userContent += '--- Context Items Attached ---\n\n';
            for (const item of params.contextItems) {
                if (item.type === 'selection') {
                    userContent += `[Code Selection: ${item.name}]\n\`\`\`\n${item.content}\n\`\`\`\n\n`;
                } else if (item.type === 'file') {
                    userContent += `[File Reference: ${item.name} (${(item as any).path || ''})]\n\`\`\`\n${item.content}\n\`\`\`\n\n`;
                } else if ((item as any).type === 'text') {
                    userContent += `[Context: ${(item as any).title || 'Instruction'}]\n${item.content}\n\n`;
                } else {
                    userContent += `[Context Item: ${item.name || 'Unknown'}]\n${item.content}\n\n`;
                }
            }
            userContent += '--- End of Context Items ---\n\n';
        }
        
        userContent += params.prompt;

        diagnostics.estimatedTokens = this.estimateTokens(systemContent) + this.estimateTokens(userContent);

        return {
            systemPrompt: systemContent.trim(),
            userPrompt: userContent.trim(),
            diagnostics
        };
    }
}
