import * as fs from 'fs';
import * as path from 'path';
import { SkillEdit } from './candidateGenerator';

export interface RejectedEdit {
    skillId: string;
    sourceVersion: number;
    candidateEdit: SkillEdit[];
    validationScore: number;
    currentScore: number;
    rejectionReason: string;
    timestamp: number;
}

export class RejectedEditBuffer {
    private static instance: RejectedEditBuffer;
    private bufferPath: string;
    private buffer: RejectedEdit[] = [];

    private constructor(workspaceRoot: string) {
        const agentsDir = path.join(workspaceRoot, '.agents', 'skill_candidates');
        if (!fs.existsSync(agentsDir)) {
            fs.mkdirSync(agentsDir, { recursive: true });
        }
        this.bufferPath = path.join(agentsDir, 'rejected_edits.json');
        this.loadBuffer();
    }

    public static getInstance(workspaceRoot: string): RejectedEditBuffer {
        if (!RejectedEditBuffer.instance) {
            RejectedEditBuffer.instance = new RejectedEditBuffer(workspaceRoot);
        }
        return RejectedEditBuffer.instance;
    }

    public static resetInstance(): void {
        (RejectedEditBuffer as any).instance = undefined;
    }

    private loadBuffer(): void {
        if (fs.existsSync(this.bufferPath)) {
            try {
                this.buffer = JSON.parse(fs.readFileSync(this.bufferPath, 'utf8'));
            } catch (e) {
                this.buffer = [];
            }
        } else {
            this.buffer = [];
        }
    }

    private saveBuffer(): void {
        fs.writeFileSync(this.bufferPath, JSON.stringify(this.buffer, null, 2), 'utf8');
    }

    public addRejectedEdit(edit: RejectedEdit): void {
        this.buffer.push(edit);
        this.saveBuffer();
    }

    public getRejectedEditsForSkill(skillId: string): RejectedEdit[] {
        return this.buffer.filter(e => e.skillId === skillId);
    }
}
