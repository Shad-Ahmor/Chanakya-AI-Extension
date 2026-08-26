import { TaskUnderstanding } from './types';
import { Logger } from '../../utils/logger';
import { LLMEngine } from '../llmEngine';

export class RequirementExtractionService {
    private readonly logger = Logger.getInstance();

    constructor(private readonly llmEngine: LLMEngine) {}

    public async extractRequirements(sourceDir: string, originalPrompt: string): Promise<TaskUnderstanding> {
        this.logger.log(`[RequirementExtraction] Extracting requirements from ${sourceDir}`);
        
        try {
            const systemPrompt = `You are an expert requirement extraction engine for an autonomous coding agent.
Your task is to analyze the user's prompt and extract a structured TaskUnderstanding JSON object.
Extract all requirements, constraints, explicit files, technologies, and ambiguities.
Output ONLY valid JSON.
{
    "intent": "Brief description of what the user wants to achieve",
    "taskType": "bug_fix | feature | refactor | investigation | configuration | documentation | testing | mixed | unknown",
    "requirements": ["List of functional and technical requirements"],
    "constraints": ["List of strict constraints"],
    "explicitFiles": ["Files explicitly mentioned in the prompt"],
    "explicitTechnologies": ["Technologies/Frameworks mentioned"],
    "expectedOutcome": "What does success look like?",
    "acceptanceCriteria": ["List of criteria to verify completion"],
    "prohibitedActions": ["Actions the user explicitly forbid"],
    "ambiguities": ["Any unclear aspects of the prompt"],
    "riskLevel": "low | medium | high",
    "requiresPlanning": true,
    "requiresRepositoryInspection": true,
    "requiresUserClarification": false
}`;

            const prompt = `${systemPrompt}\n\nUSER PROMPT:\n${originalPrompt}`;

            const response = await new Promise<string>((resolve, reject) => {
                let fullText = '';
                this.llmEngine.streamChat({
                    prompt,
                    contextItems: [],
                    callbacks: {
                        onChunk: (chunk: string) => { fullText += chunk; },
                        onComplete: (text: string) => resolve(text || fullText),
                        onError: (error: Error) => reject(error)
                    }
                }).catch(reject);
            });
            
            // Basic json parsing fallback
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            const jsonString = jsonMatch ? jsonMatch[0] : response;
            const parsed = JSON.parse(jsonString) as TaskUnderstanding;
            
            parsed.originalPrompt = originalPrompt;
            
            // Ensure priority sorting for requirements
            // This is just a structural mapping since LLM returns simple strings for requirements
            // Real sorting happens when mapping to full Requirement objects later if needed
            
            return parsed;
        } catch (error) {
            this.logger.error('[RequirementExtraction] Failed to extract requirements', error);
            
            // Fallback object on failure
            return {
                originalPrompt,
                intent: 'Failed to extract intent',
                taskType: 'unknown',
                requirements: ['Process user prompt'],
                constraints: [],
                explicitFiles: [],
                explicitTechnologies: [],
                expectedOutcome: 'Task completed',
                acceptanceCriteria: [],
                prohibitedActions: [],
                ambiguities: ['Failed to parse prompt'],
                riskLevel: 'medium',
                requiresPlanning: true,
                requiresRepositoryInspection: true,
                requiresUserClarification: false
            };
        }
    }
}
