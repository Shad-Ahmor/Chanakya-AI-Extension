import { TaskArtifact, Phase, TaskState, TaskComplexity, WorkingSet, Requirement, RequirementStatus } from './types';
import { Logger } from '../../utils/logger';
import { randomUUID } from 'crypto';
import { LongContextIngestionService } from './LongContextIngestionService';
import { RequirementExtractionService } from './RequirementExtractionService';
import * as fs from 'fs/promises';
import * as path from 'path';
import { LLMEngine } from '../llmEngine';

export class TaskDecomposer {
    private readonly logger = Logger.getInstance();

    constructor(
        private readonly ingestionService: LongContextIngestionService,
        private readonly requirementService: RequirementExtractionService,
        private readonly storageBaseDir: string,
        private readonly llmEngine: LLMEngine
    ) {}

    public async decompose(
        originalPrompt: string, 
        complexity: TaskComplexity
    ): Promise<TaskArtifact> {
        this.logger.log(`[TaskDecomposer] Decomposing task of complexity ${complexity}...`);

        try {
            const taskId = `TASK-${randomUUID().slice(0, 8)}`;
            
            // 1. Ingest
            const ingestion = await this.ingestionService.ingest(originalPrompt, taskId);
            
            // 2. Extract Requirements & TaskUnderstanding
            const understanding = await this.requirementService.extractRequirements(ingestion.sourceDir, originalPrompt);

            // 3. Decompose into Phases and Steps
            const systemPrompt = `You are a Senior Software Architect planning the execution of a task.
Based on the provided Task Understanding, break down the task into logical phases and steps.
Output ONLY valid JSON matching this schema:
{
    "phases": [
        {
            "phaseId": "string",
            "name": "string",
            "steps": [
                {
                    "stepId": "string",
                    "objective": "string",
                    "requiredInputs": ["string"],
                    "expectedOutput": "string",
                    "filesInvolved": ["string"],
                    "toolsRequired": ["string"],
                    "dependencies": ["string"],
                    "risk": "LOW | MEDIUM | HIGH",
                    "verificationMethod": "string"
                }
            ]
        }
    ]
}`;
            const prompt = `${systemPrompt}\n\nUSER PROMPT:\n${JSON.stringify(understanding)}`;
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
            
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            const jsonString = jsonMatch ? jsonMatch[0] : response;
            
            let parsedPhases: Phase[] = [];
            try {
                const parsedPlan = JSON.parse(jsonString);
                if (parsedPlan.phases && Array.isArray(parsedPlan.phases)) {
                    parsedPhases = parsedPlan.phases.map((p: any) => ({
                        ...p,
                        status: TaskState.PENDING,
                        steps: (p.steps || []).map((s: any) => ({
                            ...s,
                            status: TaskState.PENDING
                        }))
                    }));
                }
            } catch (e) {
                this.logger.error('[TaskDecomposer] Failed to parse plan JSON', e);
                parsedPhases = [{
                    phaseId: 'PHASE-DISCOVERY',
                    name: 'Discovery and Analysis',
                    status: TaskState.PENDING,
                    steps: [{
                        stepId: 'STEP-001',
                        objective: 'Analyze existing codebase structure',
                        requiredInputs: [],
                        expectedOutput: 'Understanding of file layout',
                        filesInvolved: [],
                        toolsRequired: ['workspace_search'],
                        dependencies: [],
                        risk: 'LOW',
                        verificationMethod: 'Review discovered files',
                        status: TaskState.PENDING
                    }]
                }];
            }

            const initialWorkingSet: WorkingSet = {
                currentFiles: understanding.explicitFiles || [],
                relevantFiles: [],
                recentlyModifiedFiles: [],
                referencedFiles: [],
                testFiles: [],
                configFiles: [],
                dependencyFiles: []
            };

            const mappedRequirements: Requirement[] = (understanding.requirements || []).map((desc: string, i: number) => ({
                id: `REQ-${String(i+1).padStart(3, '0')}`,
                type: 'MUST',
                description: desc,
                priority: 'NORMAL',
                category: 'functional',
                sourceSection: 'TaskUnderstanding',
                dependencies: [],
                acceptanceCriteria: [],
                status: RequirementStatus.PENDING,
                verificationMethod: 'Testing'
            }));

            // Map constraints
            (understanding.constraints || []).forEach((desc: string, i: number) => {
                mappedRequirements.push({
                    id: `CON-${String(i+1).padStart(3, '0')}`,
                    type: 'MUST NOT',
                    description: desc,
                    priority: 'CRITICAL',
                    category: 'explicit_constraint',
                    sourceSection: 'TaskUnderstanding',
                    dependencies: [],
                    acceptanceCriteria: ['Constraint maintained'],
                    status: RequirementStatus.PENDING,
                    verificationMethod: 'Manual review'
                });
            });

            const artifact: TaskArtifact = {
                taskId,
                originalInput: originalPrompt,
                normalizedGoal: understanding.intent || 'Processed task goal',
                requirements: mappedRequirements,
                constraints: understanding.constraints || [],
                acceptanceCriteria: understanding.acceptanceCriteria || [],
                referencedFiles: understanding.explicitFiles || [],
                referencedTechnologies: understanding.explicitTechnologies || [],
                detectedRisks: [],
                ambiguities: understanding.ambiguities || [],
                dependencies: [],
                assumptions: [],
                priority: understanding.riskLevel === 'high' ? 'HIGH' : 'NORMAL',
                complexity: complexity,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                phases: parsedPhases,
                state: TaskState.RECEIVED,
                workingSet: initialWorkingSet
            };

            await this.writeImplementationPlan(artifact, ingestion.sourceDir);

            return artifact;

        } catch (error) {
            this.logger.error('[TaskDecomposer] Failed to decompose task', error);
            throw error;
        }
    }

    private async writeImplementationPlan(artifact: TaskArtifact, _sourceDir: string): Promise<void> {
        const planDir = path.join(this.storageBaseDir, artifact.taskId, 'plans');
        await fs.mkdir(planDir, { recursive: true });

        let md = `# Implementation Plan\n\n`;
        md += `## Task Identity\n`;
        md += `- **Task ID**: ${artifact.taskId}\n`;
        md += `- **Complexity**: ${artifact.complexity}\n`;
        md += `- **Status**: ${artifact.state}\n\n`;

        md += `## Objective\n${artifact.normalizedGoal}\n\n`;

        md += `## Requirements\n`;
        artifact.requirements.forEach(req => {
            md += `- **${req.id}** (${req.priority} / ${req.category}): ${req.description}\n`;
        });
        md += `\n`;

        md += `## Phases\n`;
        artifact.phases.forEach(p => {
            md += `### Phase: ${p.name}\n`;
            p.steps.forEach(s => {
                md += `- **${s.stepId}**: ${s.objective} (Risk: ${s.risk})\n`;
                if (s.toolsRequired && s.toolsRequired.length > 0) md += `  - Tools: ${s.toolsRequired.join(', ')}\n`;
                if (s.verificationMethod) md += `  - Verification: ${s.verificationMethod}\n`;
            });
        });

        await fs.writeFile(path.join(planDir, 'ImplementationPlan.md'), md, 'utf-8');
    }
}
