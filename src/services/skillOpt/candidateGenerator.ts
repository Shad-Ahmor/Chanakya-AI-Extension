import { LLMGateway } from '../llmGateway';
import { ConfigManager } from '../configManager';
import { ReflectionResult } from './reflectionEngine';

import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../utils/logger';
import { RejectedEditBuffer } from './rejectedEditBuffer';
import { SelfLearningTelemetry } from '../memory/SelfLearningTelemetry';

export interface SkillEdit {
    operation: 'ADD' | 'REPLACE' | 'DELETE';
    section: string;
    content?: string;
    targetContent?: string;
    reason: string;
    evidenceTrajectoryIDs: string[];
}

export interface Candidate {
    id: string;
    skillName: string;
    baseVersion: number;
    content: string;
    edits: SkillEdit[];
    timestamp: number;
    memoryIds?: string[];
}

export interface CandidateGenerationResult {
    candidates: Candidate[];
}

export class CandidateGenerator {
    private static instance: CandidateGenerator;
    private llmGateway = LLMGateway.getInstance();

    private constructor(private workspaceRoot: string) { }

    public static getInstance(workspaceRoot: string): CandidateGenerator {
        if (!CandidateGenerator.instance) {
            CandidateGenerator.instance = new CandidateGenerator(workspaceRoot);
        }
        return CandidateGenerator.instance;
    }

    public static resetInstance(): void {
        (CandidateGenerator as any).instance = undefined;
    }

    public async generateCandidate(
        skillName: string,
        baseVersion: number,
        currentSkillContent: string,
        reflection: ReflectionResult,
        failedTrajectoryIDs: string[]
    ): Promise<CandidateGenerationResult> {
        if (reflection.improvements.length === 0) {
            return { candidates: [] };
        }

        let refStr = JSON.stringify(reflection.improvements, null, 2);
        if (refStr.length > 3000) refStr = refStr.substring(0, 3000) + '... (truncated)';

        const rejected = RejectedEditBuffer.getInstance(this.workspaceRoot).getRejectedEditsForSkill(skillName).map(r => ({ edits: r.candidateEdit, reason: r.rejectionReason }));
        let rejStr = JSON.stringify(rejected, null, 2);
        if (rejStr.length > 2000) rejStr = rejStr.substring(0, 2000) + '... (truncated)';

        const { MemoryRetriever } = require('../memory/MemoryRetriever');
        const telemetry = SelfLearningTelemetry.getInstance(this.workspaceRoot);
        const startTime = Date.now();
        const retrievedMemories = await MemoryRetriever.getInstance().retrieve(`Optimize skill ${skillName}`, 3);
        const latencyMs = Date.now() - startTime;
        
        let strategyContext = '';
        const memoryInfluenceIds: string[] = [];
        
        if (retrievedMemories.length > 0) {
            strategyContext = `## Verified Strategies From Previous Tasks\n\n`;
            let avgApplicability = 0;
            
            retrievedMemories.forEach((m: any, i: number) => {
                memoryInfluenceIds.push(m.id);
                avgApplicability += m.applicability;
                
                strategyContext += `Strategy #${i + 1}\nContext: ${m.task}\nConfidence: ${m.confidence}\nSuccesses: ${m.metadata?.successCount || 0}\nFailures: ${m.metadata?.failureCount || 0}\n\n`;
                if (m.type === 'procedural') {
                    strategyContext += `Procedure:\n${m.content}\n\n`;
                } else if (m.type === 'mistake') {
                    strategyContext += `Avoid:\n${m.content}\n\n`;
                }
            });
            avgApplicability /= retrievedMemories.length;
            
            const memoryInfluence = {
                used: true,
                memoryIds: memoryInfluenceIds,
                applicability: avgApplicability.toFixed(2)
            };
            
            console.log(`[CandidateGenerator]\nApplying learned strategy`);
            console.log(JSON.stringify({ memoryInfluence }, null, 2));
            
            telemetry.logMemoryRetrieval(latencyMs, Math.ceil(strategyContext.length / 2.8), retrievedMemories.length);
        } else {
            telemetry.logMemoryRetrieval(latencyMs, 0, 0);
        }

        const prompt = `You are an expert AI behavior optimizer.
You are given the current skill instructions and a reflection report detailing behavioral problems and improvements.
Generate a minimal, evidence-based set of edits to improve the skill.
Do not invent problems. Do not make unrelated changes. Do not remove useful existing behavior.

Strict Edit Budget:
- Maximum Additions: 2
- Maximum Deletions: 2
- Maximum Replacements: 2

${strategyContext}
Use relevant verified strategies as guidance. Do not blindly copy them. Adapt them to the current task and current codebase.

Current Skill:
\`\`\`markdown
${currentSkillContent}
\`\`\`

Reflection Improvements:
${refStr}

Available Evidence Trajectory IDs:
${JSON.stringify(failedTrajectoryIDs)}

Rejected Candidate Edits (DO NOT SUGGEST THESE AGAIN):
${rejStr}

Output your edits as ONLY a valid JSON array of objects matching this schema:
[
  {
    "operation": "ADD" | "REPLACE" | "DELETE",
    "section": "The name of the section you are modifying or adding to",
    "content": "The new content to ADD or REPLACE with",
    "targetContent": "The exact existing content to REPLACE or DELETE",
    "reason": "Detailed explanation of why this edit is proposed",
    "evidenceTrajectoryIDs": ["List of trajectory IDs supporting this change"]
  }
]
No markdown formatting, no explanation. Just the JSON array.`;

        return new Promise<CandidateGenerationResult>((resolve, reject) => {
            let fullText = '';

            const activeOptimizerModelId = ConfigManager.getInstance().getConfig().activeOptimizerModelId;

            this.llmGateway.streamChat({
                prompt: prompt,
                contextItems: [],
                existingMessages: [{ role: 'system', content: 'You are a JSON-only API. Respond only with a valid JSON array.' }],
                targetModelId: activeOptimizerModelId,
                callbacks: {
                    onChunk: (chunk: string) => {
                        fullText += chunk;
                    },
                    onComplete: async (text: string) => {
                        try {
                            let cleanedText = (text.includes('</think>') ? text.split('</think>')[1] : text);
                            const match = cleanedText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
                            cleanedText = match ? match[0] : cleanedText;
                            const edits = JSON.parse(cleanedText) as SkillEdit[];

                            // Budget validation
                            const adds = edits.filter(e => e.operation === 'ADD').length;
                            const deletes = edits.filter(e => e.operation === 'DELETE').length;
                            const replaces = edits.filter(e => e.operation === 'REPLACE').length;

                            if (adds > 2 || deletes > 2 || replaces > 2) {
                                Logger.getInstance().log('The edits exceeded the budget limits. Truncating excess edits.');
                            }

                            // Strictly enforcing the budget
                            const allowedEdits = [
                                ...edits.filter(e => e.operation === 'ADD').slice(0, 2),
                                ...edits.filter(e => e.operation === 'DELETE').slice(0, 2),
                                ...edits.filter(e => e.operation === 'REPLACE').slice(0, 2)
                            ];

                            const candidateContent = this.applyEdits(currentSkillContent, allowedEdits);

                            const candidate: Candidate = {
                                id: `cand_${Date.now()}`,
                                skillName,
                                baseVersion,
                                content: candidateContent,
                                edits: allowedEdits,
                                timestamp: Date.now(),
                                memoryIds: memoryInfluenceIds
                            };

                            await this.saveCandidate(candidate);
                            resolve({ candidates: [candidate] });
                        } catch (e) {
                            Logger.getInstance().warn('Failed to parse candidate JSON, returning empty candidates: ' + e);
                            resolve({ candidates: [] });
                        }
                    },
                    onError: (error: Error) => {
                        reject(error);
                    }
                }
            });
        });
    }

    private async saveCandidate(candidate: Candidate): Promise<void> {
        const candidateDir = path.join(this.workspaceRoot, '.agents', 'skill_candidates');
        await fs.mkdir(candidateDir, { recursive: true });

        const filePath = path.join(candidateDir, `${candidate.id}.json`);
        await fs.writeFile(filePath, JSON.stringify(candidate, null, 2), 'utf8');
    }

    public applyEdits(currentContent: string, edits: SkillEdit[]): string {
        let newContent = currentContent;
        for (const edit of edits) {
            if (edit.operation === 'ADD') {
                if (edit.section && newContent.includes(edit.section)) {
                    // Simple append to section
                    newContent = newContent.replace(edit.section, edit.section + '\n' + edit.content);
                } else {
                    // Append to bottom if section not found
                    newContent += '\n\n' + (edit.section ? `## ${edit.section}\n` : '') + edit.content;
                }
            } else if (edit.operation === 'REPLACE' && edit.targetContent && edit.content) {
                newContent = newContent.replace(edit.targetContent, edit.content);
            } else if (edit.operation === 'DELETE' && edit.targetContent) {
                newContent = newContent.replace(edit.targetContent, '');
            }
        }
        return newContent.trim();
    }
}