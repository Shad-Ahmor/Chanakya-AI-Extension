import * as fs from 'fs/promises';
import * as path from 'path';

export interface SkillTask {
    id: string;
    description: string;
    expectedOutcome: string;
    type: 'train' | 'val' | 'test';
    workspace?: string; // Path to starter project template
    validation?: {
        commands: string[]; // Commands to verify completion
    };
}

export interface TaskDataset {
    skillName: string;
    tasks: SkillTask[];
}

export class TaskDatasetManager {
    private static instance: TaskDatasetManager;
    private datasetDir: string;

    private constructor(workspaceRoot: string) {
        this.datasetDir = path.join(workspaceRoot, '.agents', 'datasets');
    }

    public static getInstance(workspaceRoot: string): TaskDatasetManager {
        if (!TaskDatasetManager.instance) {
            TaskDatasetManager.instance = new TaskDatasetManager(workspaceRoot);
        }
        return TaskDatasetManager.instance;
    }

    public static resetInstance(): void {
        (TaskDatasetManager as any).instance = undefined;
    }

    public async initialize(): Promise<void> {
        try {
            await fs.mkdir(this.datasetDir, { recursive: true });
        } catch (e) {
            // Ignore if exists
        }
    }

    public async getDataset(skillName: string): Promise<TaskDataset> {
        const filePath = path.join(this.datasetDir, `${skillName}.json`);
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data) as TaskDataset;
        } catch (e: any) {
            if (e.code === 'ENOENT') {
                return { skillName, tasks: [] };
            }
            throw new Error(`Failed to load dataset for ${skillName}: ${e.message}`);
        }
    }

    public async saveDataset(dataset: TaskDataset): Promise<void> {
        await this.initialize();
        const filePath = path.join(this.datasetDir, `${dataset.skillName}.json`);
        await fs.writeFile(filePath, JSON.stringify(dataset, null, 2), 'utf8');
    }

    public async getTasksByType(skillName: string, type: 'train' | 'val' | 'test'): Promise<SkillTask[]> {
        const dataset = await this.getDataset(skillName);
        return dataset.tasks.filter(t => t.type === type);
    }
}
