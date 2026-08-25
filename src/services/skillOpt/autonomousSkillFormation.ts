import { Logger } from '../../utils/logger';
import { VectorStore } from '../memory/VectorStore';
import { MemoryRecord } from '../../types/memory';
import { LLMGateway } from '../llmGateway';
import { SkillRegistry } from './skillRegistry';
import { SkillValidator } from './skillValidator';
import { ValidationGate } from './validationGate';
import { ConfigManager } from '../configManager';

export class AutonomousSkillFormation {
    private static instance: AutonomousSkillFormation;
    private logger = Logger.getInstance();
    private vectorStore = VectorStore.getInstance();
    private llmGateway = LLMGateway.getInstance();
    private skillRegistry!: SkillRegistry;
    private skillValidator = SkillValidator.getInstance();
    private validationGate = ValidationGate.getInstance();
    
    // RC-3 & RC-5: Filter state to prevent duplicate processing and LLM waste
    private processedMemoryIds: Set<string> = new Set();
    
    private constructor(workspaceRoot: string) {
        this.skillRegistry = SkillRegistry.getInstance(workspaceRoot);
    }
    
    public static getInstance(workspaceRoot: string): AutonomousSkillFormation {
        if (!AutonomousSkillFormation.instance) {
            AutonomousSkillFormation.instance = new AutonomousSkillFormation(workspaceRoot);
        }
        return AutonomousSkillFormation.instance;
    }
    
    /**
     * Scans VectorStore for high-confidence procedural memories,
     * generalizes them into reusable skills, validates them via SkillOpt,
     * and persists them to the SkillRegistry.
     */
    public async evaluatePatterns(): Promise<void> {
        try {
            this.logger.log('Starting Autonomous Skill Formation evaluation cycle...');
            
            const minSuccessCount = 3; // Hardcoded default as requested
            const confidenceThreshold = 0.85;
            
            const allMemories = await this.vectorStore.getAllMemories();
            
            // Filter highly successful procedural memories that haven't been processed yet
            const candidates = allMemories.filter(m => 
                m.type === 'SUCCESSFUL_PROCEDURE' &&
                m.confidence >= confidenceThreshold &&
                (m.metadata.successCount || 0) >= minSuccessCount &&
                !this.processedMemoryIds.has(m.id)
            );
            
            if (candidates.length === 0) {
                this.logger.log('No new eligible procedural memories found. Skipping autonomous abstraction.');
                return;
            }
            
            this.logger.log(`Found ${candidates.length} new procedural memories eligible for skill abstraction.`);
            
            // For simplicity in V1, we evaluate them individually. 
            // V2 could cluster them by tag or semantic similarity.
            for (const memory of candidates) {
                this.processedMemoryIds.add(memory.id); // Mark as processed regardless of outcome
                await this.processMemoryIntoSkill(memory);
            }
            
        } catch (error) {
            this.logger.error('[AutonomousSkillFormation] Cycle failed safely. Error during evaluation:', error);
        }
    }
    
    private async processMemoryIntoSkill(memory: MemoryRecord): Promise<void> {
        this.logger.log(`Abstracting skill from memory ${memory.id} - ${memory.task}`);
        
        const prompt = `You are an expert software engineer. Extract a reusable, generalized agent skill from the following procedural memory.
The skill MUST provide step-by-step instructions for an AI agent to solve similar tasks.

Original Task: ${memory.task}
Strategy Used: ${memory.content}

Format your response as a valid markdown file with YAML frontmatter containing 'name' and 'description'.
DO NOT wrap the output in markdown code blocks. Just output the raw markdown file.

Example:
---
name: React Component Debugging
description: Standard procedure for debugging and modifying React components.
---
# Instructions
1. Discover the component using workspace search.
2. Inspect dependencies and state.
3. Make the minimal change.
4. Run relevant tests.
5. Verify output.
`;
        
        try {
            const activeOptimizerModelId = ConfigManager.getInstance().getConfig().activeOptimizerModelId;
            let candidateContent = '';
            
            await new Promise<void>((resolve, reject) => {
                this.llmGateway.streamChat({
                    prompt: prompt,
                    contextItems: [],
                    existingMessages: [{ role: 'system', content: 'You are an expert software engineer.' }],
                    targetModelId: activeOptimizerModelId,
                    callbacks: {
                        onChunk: (token: string) => { candidateContent += token; },
                        onComplete: () => resolve(),
                        onError: (error: any) => reject(error)
                    }
                });
            });
            
            candidateContent = candidateContent.trim();
            
            const validationScoreResult = await this.skillValidator.validateCandidate(
                candidateContent,
                { observations: [], improvements: [{ proceduralRule: 'Extracted into reusable generalized skill.', whatWorked: 'It worked', whatFailed: '', causeOfFailure: '' }] },
                [{ taskId: memory.id, task: memory.task, skill: 'auto', skillVersion: 1, toolCalls: [], retries: 0, success: true, durationMs: 0, timestamp: 0 }],
                0.5 // Baseline arbitrary score for un-generalized memory
            );
            
            // If the LLM assigned a high validation score (e.g., > 0.8), accept it.
            const decision = this.validationGate.evaluateDecision(0.7, validationScoreResult.score);
            
            if (decision.decision === 'accepted') {
                this.logger.log(`Skill extracted and ACCEPTED by SkillOpt (Score: ${validationScoreResult.score})`);
                
                // Parse frontmatter
                const nameMatch = candidateContent.match(/name:\s*(.+)/);
                const descMatch = candidateContent.match(/description:\s*(.+)/);
                const name = nameMatch ? nameMatch[1].trim().replace(/\s+/g, '-').toLowerCase() : `auto-skill-${memory.id.substring(0, 6)}`;
                const description = descMatch ? descMatch[1].trim() : 'Autonomously generated skill';
                
                this.skillRegistry.createSkillVersion(name, candidateContent, undefined, description);
                this.logger.log(`Registered new autonomous skill: ${name}`);
            } else {
                this.logger.log(`Skill rejected by SkillOpt: ${decision.reason}`);
            }
        } catch (error) {
            this.logger.error(`Failed to process memory ${memory.id} into skill`, error);
        }
    }
}
