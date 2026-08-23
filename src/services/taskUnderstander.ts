import { LLMGateway } from './llmGateway';
import { ConfigManager } from './configManager';
import { SkillRegistry } from './skillOpt/skillRegistry';

export interface TaskRoutingInfo {
    needsRAG: boolean;
    needsMCP: boolean;
    relevantSkills: string[];
    needsRules: boolean;
}

export class TaskUnderstander {
    private static instance: TaskUnderstander;
    private llmGateway = LLMGateway.getInstance();
    private workspaceRoot: string;

    private constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    public static getInstance(workspaceRoot: string): TaskUnderstander {
        if (!TaskUnderstander.instance) {
            TaskUnderstander.instance = new TaskUnderstander(workspaceRoot);
        }
        return TaskUnderstander.instance;
    }

    public async understandTask(prompt: string): Promise<TaskRoutingInfo> {
        const registry = SkillRegistry.getInstance(this.workspaceRoot);
        const activeSkills = registry.listSkills().filter(s => {
            const meta = registry.getSkillCategoryMetadata(s);
            return meta && meta.enabled !== false && !meta.userDeleted;
        });

        const skillDescriptions = activeSkills.map(s => {
            const meta = registry.getSkillCategoryMetadata(s);
            return `- ${s}: ${meta?.description || 'No description'}`;
        }).join('\n');

        const sysPrompt = `You are the Task Routing Understander for an autonomous AI agent.
Analyze the user's prompt and determine which subsystems and specific skills are relevant to fulfilling it.

Available Skills:
${skillDescriptions}

1. needsRAG: True if the user asks to search the codebase, read documentation, look up existing code, or needs project knowledge.
2. needsMCP: True if the user asks to interact with external tools, APIs, modify files, run terminal commands, or perform actions.
3. relevantSkills: An array of skill names (from the Available Skills list) that provide relevant behavioral guidance for this task.
4. needsRules: True for almost all tasks, as it enforces global safety and architectural constraints.

Return your analysis as ONLY a JSON object matching exactly this schema, with no markdown formatting or extra text:
{
  "needsRAG": boolean,
  "needsMCP": boolean,
  "relevantSkills": string[],
  "needsRules": boolean
}

User Prompt:
${prompt}
`;

        return new Promise<TaskRoutingInfo>((resolve, reject) => {
            let fullText = '';
            
            const config = ConfigManager.getInstance().getConfig();
            
            this.llmGateway.streamChat({
                prompt: sysPrompt,
                contextItems: [],
                existingMessages: [{ role: 'system', content: 'You are a JSON-only API. Respond only with valid JSON. Do not use markdown blocks.' }],
                targetModelId: config.activeChatModelId,
                optimizerConfig: { taskType: 'chat' }, // Use fast model for routing
                callbacks: {
                    onChunk: (chunk: string) => {
                        fullText += chunk;
                    },
                    onComplete: (text: string) => {
                        try {
                            const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                            const result = JSON.parse(cleanedText) as TaskRoutingInfo;
                            
                            const filteredSkills = (result.relevantSkills || []).filter(s => activeSkills.includes(s));
                            
                            resolve({
                                needsRAG: !!result.needsRAG,
                                needsMCP: !!result.needsMCP,
                                relevantSkills: filteredSkills,
                                needsRules: !!result.needsRules
                            });
                        } catch (e) {
                            resolve({ needsRAG: false, needsMCP: true, relevantSkills: ['react'], needsRules: true });
                        }
                    },
                    onError: (error: Error) => {
                        reject(error);
                    }
                }
            });
        });
    }
}
