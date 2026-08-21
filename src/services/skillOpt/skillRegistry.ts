import * as fs from 'fs';
import * as path from 'path';

export interface SkillVersionInfo {
    version: number;
    parentVersion?: number;
    status: 'draft' | 'active' | 'archived' | 'best';
    score?: number;
    createdAt: number;
    changeDescription?: string;
}

export interface SkillCategoryMetadata {
    skillName: string;
    bestVersion: number;
    versions: SkillVersionInfo[];
}

export interface Skill {
    metadata: SkillVersionInfo;
    content: string; // Markdown content
}

export class SkillRegistry {
    private static instance: SkillRegistry;
    private skillsDir: string;

    private constructor(workspaceRoot: string) {
        this.skillsDir = path.join(workspaceRoot, '.agents', 'skills');
        if (!fs.existsSync(this.skillsDir)) {
            fs.mkdirSync(this.skillsDir, { recursive: true });
        }
    }

    public static getInstance(workspaceRoot: string): SkillRegistry {
        if (!SkillRegistry.instance) {
            SkillRegistry.instance = new SkillRegistry(workspaceRoot);
        }
        return SkillRegistry.instance;
    }

    public static resetInstance(): void {
        (SkillRegistry as any).instance = undefined;
    }

    public listSkills(): string[] {
        if (!fs.existsSync(this.skillsDir)) return [];
        return fs.readdirSync(this.skillsDir).filter(f => fs.statSync(path.join(this.skillsDir, f)).isDirectory());
    }

    private loadMetadata(category: string): SkillCategoryMetadata | null {
        const metadataPath = path.join(this.skillsDir, category, 'metadata.json');
        if (fs.existsSync(metadataPath)) {
            return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        }
        return null;
    }

    private saveMetadata(category: string, metadata: SkillCategoryMetadata): void {
        const categoryDir = path.join(this.skillsDir, category);
        if (!fs.existsSync(categoryDir)) {
            fs.mkdirSync(categoryDir, { recursive: true });
        }
        const metadataPath = path.join(categoryDir, 'metadata.json');
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    }

    public loadSkill(category: string, version: number): Skill | null {
        const metadata = this.loadMetadata(category);
        if (!metadata) return null;

        const versionInfo = metadata.versions.find(v => v.version === version);
        if (!versionInfo) return null;

        const skillPath = path.join(this.skillsDir, category, `skill_v${version}.md`);
        if (fs.existsSync(skillPath)) {
            const content = fs.readFileSync(skillPath, 'utf8');
            return { metadata: versionInfo, content };
        }
        return null;
    }

    public getBestSkill(category: string): Skill | null {
        const metadata = this.loadMetadata(category);
        if (!metadata || !metadata.bestVersion) return null;
        return this.loadSkill(category, metadata.bestVersion);
    }

    public createSkillVersion(category: string, content: string, parentVersion?: number, changeDescription?: string): Skill {
        const metadata = this.loadMetadata(category) || {
            skillName: category,
            bestVersion: 0,
            versions: []
        };

        const nextVersion = metadata.versions.length > 0 
            ? Math.max(...metadata.versions.map(v => v.version)) + 1 
            : 1;

        const versionInfo: SkillVersionInfo = {
            version: nextVersion,
            status: 'draft',
            createdAt: Date.now()
        };
        if (parentVersion !== undefined) versionInfo.parentVersion = parentVersion;
        if (changeDescription !== undefined) versionInfo.changeDescription = changeDescription;

        return {
            metadata: versionInfo,
            content
        };
    }

    public saveSkillVersion(category: string, skill: Skill): void {
        const categoryDir = path.join(this.skillsDir, category);
        if (!fs.existsSync(categoryDir)) {
            fs.mkdirSync(categoryDir, { recursive: true });
        }

        const metadata = this.loadMetadata(category) || {
            skillName: category,
            bestVersion: 0,
            versions: []
        };

        const existingIdx = metadata.versions.findIndex(v => v.version === skill.metadata.version);
        if (existingIdx >= 0) {
            // We never overwrite historical versions if they are already saved (except updating status)
            // But if we are creating a new one, we save it.
            metadata.versions[existingIdx] = skill.metadata;
        } else {
            metadata.versions.push(skill.metadata);
        }

        const skillPath = path.join(categoryDir, `skill_v${skill.metadata.version}.md`);
        // Only write file if it doesn't exist to protect history, or if it's draft being updated
        if (!fs.existsSync(skillPath) || skill.metadata.status === 'draft') {
            fs.writeFileSync(skillPath, skill.content, 'utf8');
        }

        this.saveMetadata(category, metadata);
    }

    public promoteSkill(category: string, version: number): void {
        const metadata = this.loadMetadata(category);
        if (!metadata) return;

        const versionInfo = metadata.versions.find(v => v.version === version);
        if (versionInfo) {
            // Demote previous best
            if (metadata.bestVersion) {
                const prevBest = metadata.versions.find(v => v.version === metadata.bestVersion);
                if (prevBest) prevBest.status = 'archived';
            }
            versionInfo.status = 'best';
            metadata.bestVersion = version;
            this.saveMetadata(category, metadata);
        }
    }

    public rollbackSkill(category: string, versionToRollbackTo: number): void {
        const metadata = this.loadMetadata(category);
        if (!metadata) return;

        const versionInfo = metadata.versions.find(v => v.version === versionToRollbackTo);
        if (versionInfo) {
            if (metadata.bestVersion) {
                const prevBest = metadata.versions.find(v => v.version === metadata.bestVersion);
                if (prevBest) prevBest.status = 'archived';
            }
            versionInfo.status = 'best';
            metadata.bestVersion = versionToRollbackTo;
            this.saveMetadata(category, metadata);
        }
    }
}
