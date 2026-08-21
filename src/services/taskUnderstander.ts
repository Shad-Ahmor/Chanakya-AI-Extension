import { AIService } from './aiService';

export interface TaskRoutingInfo {
    needsRAG: boolean;
    needsMCP: boolean;
    needsSkillOps: boolean;
    needsRules: boolean;
}

export class TaskUnderstander {
    private static instance: TaskUnderstander;
    private aiService = AIService.getInstance();

    private constructor() {}

    public static getInstance(): TaskUnderstander {
        if (!TaskUnderstander.instance) {
            TaskUnderstander.instance = new TaskUnderstander();
        }
        return TaskUnderstander.instance;
    }

    public async understandTask(prompt: string): Promise<TaskRoutingInfo> {
        const sysPrompt = `You are the Task Routing Understander for an autonomous AI agent.
Analyze the user's prompt and determine which of the following 4 independent subsystems are relevant to fulfilling it.
You may select multiple subsystems. Do not force exactly one child.

Rules should normally be considered for every task if the project architecture requires global safety rules (e.g. constraints, security).
SkillOps should provide behavioral guidance.
RAG should provide knowledge.
MCP should provide actions/tools.

Examples:
- Question about project documentation: RAG=true, MCP=false, SkillOps=false/true, Rules=true
- File modification: RAG=true/false, MCP=true, SkillOps=true, Rules=true
- General question: RAG=false, MCP=false, SkillOps=false/true, Rules=true

1. needsRAG: True if the user asks to search the codebase, read documentation, look up existing code, or needs project knowledge.
2. needsMCP: True if the user asks to interact with external tools, APIs, modify files, run terminal commands, or perform actions.
3. needsSkillOps: True if the task requires specific behavioral workflows, automation, or complex procedural guidance.
4. needsRules: True for almost all tasks, as it enforces global safety and architectural constraints.

Return your analysis as ONLY a JSON object matching exactly this schema, with no markdown formatting or extra text:
{
  "needsRAG": boolean,
  "needsMCP": boolean,
  "needsSkillOps": boolean,
  "needsRules": boolean
}

User Prompt:
${prompt}
`;

        return new Promise<TaskRoutingInfo>((resolve, reject) => {
            let fullText = '';
            
            this.aiService.streamCompletion({
                prompt: sysPrompt,
                systemInstruction: 'You are a JSON-only API. Respond only with valid JSON. Do not use markdown blocks.',
                callbacks: {
                    onChunk: (chunk: string) => {
                        fullText += chunk;
                    },
                    onComplete: (text: string) => {
                        try {
                            const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                            const result = JSON.parse(cleanedText) as TaskRoutingInfo;
                            resolve({
                                needsRAG: !!result.needsRAG,
                                needsMCP: !!result.needsMCP,
                                needsSkillOps: !!result.needsSkillOps,
                                needsRules: !!result.needsRules
                            });
                        } catch (e) {
                            reject(new Error('Failed to parse TaskUnderstander JSON: ' + (e as Error).message));
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
