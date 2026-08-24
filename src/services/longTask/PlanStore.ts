import * as fs from 'fs';
import * as path from 'path';
import { TaskArtifact, TaskCheckpoint, TaskState } from './types';
import { Logger } from '../../utils/logger';

export class PlanStore {
    private readonly logger = Logger.getInstance();
    private readonly baseDir: string;

    constructor(workspaceRoot?: string) {
        // Use local workspace directory for tasks (defaulting to .chanakya/tasks)
        this.baseDir = workspaceRoot 
            ? path.join(workspaceRoot, '.chanakya', 'tasks')
            : path.join(process.cwd(), '.chanakya', 'tasks');

        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
        }
    }

    private getTaskDir(taskId: string): string {
        const taskDir = path.join(this.baseDir, taskId);
        if (!fs.existsSync(taskDir)) {
            fs.mkdirSync(taskDir, { recursive: true });
        }
        return taskDir;
    }

    public async saveTask(artifact: TaskArtifact): Promise<void> {
        const dir = this.getTaskDir(artifact.taskId);
        
        // Save TASK.json
        fs.writeFileSync(
            path.join(dir, 'TASK.json'),
            JSON.stringify(artifact, null, 2),
            'utf-8'
        );

        // Generate PLAN.md
        const planMarkdown = this.generatePlanMarkdown(artifact);
        fs.writeFileSync(
            path.join(dir, 'PLAN.md'),
            planMarkdown,
            'utf-8'
        );

        this.logger.log(`[PlanStore] Saved TaskArtifact and PLAN.md for task ${artifact.taskId}`);
    }

    public async loadTask(taskId: string): Promise<TaskArtifact | null> {
        const file = path.join(this.baseDir, taskId, 'TASK.json');
        if (!fs.existsSync(file)) return null;

        try {
            const raw = fs.readFileSync(file, 'utf-8');
            return JSON.parse(raw) as TaskArtifact;
        } catch (err) {
            this.logger.error(`[PlanStore] Failed to load TASK.json for ${taskId}`, err);
            return null;
        }
    }

    public async saveCheckpoint(checkpoint: TaskCheckpoint): Promise<void> {
        const dir = this.getTaskDir(checkpoint.taskId);
        
        fs.writeFileSync(
            path.join(dir, 'CHECKPOINT.json'),
            JSON.stringify(checkpoint, null, 2),
            'utf-8'
        );
    }

    public async loadCheckpoint(taskId: string): Promise<TaskCheckpoint | null> {
        const file = path.join(this.baseDir, taskId, 'CHECKPOINT.json');
        if (!fs.existsSync(file)) return null;

        try {
            const raw = fs.readFileSync(file, 'utf-8');
            return JSON.parse(raw) as TaskCheckpoint;
        } catch (err) {
            this.logger.error(`[PlanStore] Failed to load CHECKPOINT.json for ${taskId}`, err);
            return null;
        }
    }

    /**
     * Lists all task IDs that are currently in an active/incomplete state.
     * Used by TaskRecoveryManager to find resumable tasks on startup.
     */
    public async listInProgressTasks(): Promise<string[]> {
        if (!fs.existsSync(this.baseDir)) return [];
        const dirs = fs.readdirSync(this.baseDir, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name);

        const inProgress: string[] = [];
        for (const taskId of dirs) {
            const artifact = await this.loadTask(taskId);
            if (artifact && artifact.state !== TaskState.COMPLETED && artifact.state !== TaskState.CANCELLED) {
                inProgress.push(taskId);
            }
        }
        return inProgress;
    }

    private generatePlanMarkdown(artifact: TaskArtifact): string {
        let md = `# Task Plan\n\n`;
        md += `## Task ID\n${artifact.taskId}\n\n`;
        md += `## Objective\n${artifact.normalizedGoal}\n\n`;
        
        md += `## Requirements\n`;
        for (const req of artifact.requirements) {
            const checkbox = req.status === 'SATISFIED' ? '[x]' : '[ ]';
            md += `- ${checkbox} **${req.id}** (${req.type}): ${req.description}\n`;
        }
        md += `\n`;

        md += `## Constraints\n`;
        for (const c of artifact.constraints) {
            md += `- ${c}\n`;
        }
        md += `\n`;

        md += `## Acceptance Criteria\n`;
        for (const ac of artifact.acceptanceCriteria) {
            md += `- ${ac}\n`;
        }
        md += `\n`;

        md += `## Risks\n`;
        for (const r of artifact.detectedRisks) {
            md += `- ${r}\n`;
        }
        md += `\n`;

        md += `## Execution Strategy\n`;
        for (const phase of artifact.phases) {
            md += `### ${phase.name} (${phase.phaseId})\n`;
            for (const step of phase.steps) {
                const stepCheckbox = step.status === 'COMPLETED' ? '[x]' : '[ ]';
                md += `- ${stepCheckbox} **${step.stepId}**: ${step.objective}\n`;
                if (step.filesInvolved.length > 0) {
                    md += `  - Files: ${step.filesInvolved.join(', ')}\n`;
                }
            }
            md += `\n`;
        }

        return md;
    }
}
