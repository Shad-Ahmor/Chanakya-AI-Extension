import { TaskArtifact, Phase, TaskState, TaskComplexity, WorkingSet } from './types';
import { Logger } from '../../utils/logger';
import { randomUUID } from 'crypto';
import { LongContextIngestionService } from './LongContextIngestionService';
import { RequirementExtractionService } from './RequirementExtractionService';
import * as fs from 'fs/promises';
import * as path from 'path';

export class TaskDecomposer {
    private readonly logger = Logger.getInstance();

    constructor(
        private readonly ingestionService: LongContextIngestionService,
        private readonly requirementService: RequirementExtractionService,
        private readonly storageBaseDir: string
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
            
            // 2. Extract Requirements
            const requirements = await this.requirementService.extractRequirements(ingestion.sourceDir);

            // 3. Decompose into Phases and Steps
            // In a real execution, we would call LLMEngine here with the requirements and summaries
            const phases: Phase[] = [
                {
                    phaseId: `PHASE-DISCOVERY`,
                    name: 'Discovery and Analysis',
                    status: TaskState.PENDING,
                    steps: [
                        {
                            stepId: `STEP-001`,
                            objective: 'Analyze existing codebase structure',
                            requiredInputs: [],
                            expectedOutput: 'Understanding of file layout',
                            filesInvolved: [],
                            toolsRequired: ['workspace_search'],
                            dependencies: [],
                            risk: 'LOW',
                            verificationMethod: 'Review discovered files',
                            status: TaskState.PENDING
                        }
                    ]
                }
            ];

            const initialWorkingSet: WorkingSet = {
                currentFiles: [],
                relevantFiles: [],
                recentlyModifiedFiles: [],
                referencedFiles: [],
                testFiles: [],
                configFiles: [],
                dependencyFiles: []
            };

            const artifact: TaskArtifact = {
                taskId,
                originalInput: originalPrompt,
                normalizedGoal: 'Processed task goal',
                requirements,
                constraints: ['Maintain existing architecture'],
                acceptanceCriteria: ['All tests pass'],
                referencedFiles: [],
                referencedTechnologies: [],
                detectedRisks: ['Potential side-effects in legacy code'],
                ambiguities: [],
                dependencies: [],
                assumptions: ['User has committed recent changes'],
                priority: 'NORMAL',
                complexity: complexity,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                phases: phases,
                state: TaskState.RECEIVED,
                workingSet: initialWorkingSet
            };

            // Generate physical ImplementationPlan.md
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

        md += `## Constraints\n`;
        artifact.constraints.forEach(c => md += `- ${c}\n`);
        md += `\n`;

        md += `## Phases\n`;
        artifact.phases.forEach(p => {
            md += `### Phase: ${p.name}\n`;
            p.steps.forEach(s => {
                md += `- **${s.stepId}**: ${s.objective} (Risk: ${s.risk})\n`;
                if (s.toolsRequired.length > 0) md += `  - Tools: ${s.toolsRequired.join(', ')}\n`;
                if (s.verificationMethod) md += `  - Verification: ${s.verificationMethod}\n`;
            });
        });

        await fs.writeFile(path.join(planDir, 'ImplementationPlan.md'), md, 'utf-8');
    }
}
