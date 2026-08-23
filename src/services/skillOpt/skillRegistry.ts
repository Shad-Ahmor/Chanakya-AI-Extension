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
    description?: string;
    enabled?: boolean;
    bestVersion: number;
    versions: SkillVersionInfo[];

    // ── Built-in tracking fields ──────────────────────────────────────────────
    /** True when this skill was installed by the BuiltInSkillSeeder. */
    builtIn?: boolean;
    /** The organisation that manages this built-in skill. */
    source?: string;
    /** The system responsible for seeding/upgrading this skill. */
    managedBy?: string;
    /**
     * The built-in catalogue version that was last seeded.
     * Compared against the file-level SEED_VERSION constant to detect upgrades.
     */
    seedVersion?: number;
    /**
     * The highest built-in version ever seeded for this skill ID.
     * Kept separately so we can present a "new built-in available" diff to the
     * user even after they have edited the skill.
     */
    builtInVersion?: number;
    /**
     * True once a user has edited/promoted a version after initial seeding.
     * When true the seeder will NEVER overwrite the active version — it will
     * only record the latest built-in content for a future optional upgrade.
     */
    userModified?: boolean;
    /**
     * Set to true when a user explicitly deletes a built-in skill.
     * The BuiltInSkillSeeder MUST respect this flag and NEVER recreate the skill.
     * The skill directory is kept on disk so version history is preserved.
     */
    userDeleted?: boolean;
    /** @deprecated Use `seedVersion` instead. Kept for backwards compatibility. */
    sourceVersion?: string;
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
        if (!metadata || !metadata.bestVersion || metadata.enabled === false) return null;
        return this.loadSkill(category, metadata.bestVersion);
    }
    
    public getSkillCategoryMetadata(category: string): SkillCategoryMetadata | null {
        return this.loadMetadata(category);
    }

    public updateSkillCategoryMetadata(category: string, patch: Partial<SkillCategoryMetadata>): void {
        // Create a baseline if the metadata file does not exist yet (e.g. called
        // right after createSkillVersion for a brand-new user-created skill).
        const metadata = this.loadMetadata(category) ?? {
            skillName: category,
            bestVersion: 0,
            versions: [],
        } as SkillCategoryMetadata;
        Object.assign(metadata, patch);
        this.saveMetadata(category, metadata);
    }

    /**
     * Hard-deletes a skill category and ALL its version history from disk.
     * Only call this for **user-created** skills.
     * For built-in skills use `softDeleteSkill()` to preserve history.
     */
    public deleteSkillCategory(category: string): boolean {
        const categoryDir = path.join(this.skillsDir, category);
        if (fs.existsSync(categoryDir)) {
            fs.rmSync(categoryDir, { recursive: true, force: true });
            return true;
        }
        return false;
    }

    /**
     * Soft-deletes a built-in skill.
     * The skill directory and all version files are preserved so history is
     * never lost.  The skill is disabled and marked `userDeleted = true` so:
     *   - It will NOT be injected into LLM context.
     *   - The BuiltInSkillSeeder will NOT recreate it on next startup.
     *   - The Dashboard can show a "Restore" button using the flag.
     */
    public softDeleteSkill(category: string): boolean {
        const metadata = this.loadMetadata(category);
        if (!metadata) return false;
        metadata.enabled     = false;
        metadata.userDeleted = true;
        this.saveMetadata(category, metadata);
        return true;
    }

    /**
     * Restores a built-in skill from its original content.
     *
     * Creates a **new version** with the provided content and promotes it.
     * The previous user-modified version stays in version history — it is
     * NOT destroyed.  After restoration:
     *   - `userDeleted`  is cleared (false)
     *   - `userModified` is cleared (false)
     *   - `enabled`      is set to true
     *
     * @param category        The skill ID (e.g. "react")
     * @param content         The original built-in markdown content
     * @param changeDescription  Human-readable reason recorded in version info
     * @returns The newly created Skill version
     */
    public restoreBuiltInSkill(
        category         : string,
        content          : string,
        changeDescription: string = 'Restored from original built-in content',
    ): Skill {
        const restoredSkill = this.createSkillVersion(
            category,
            content,
            this.loadMetadata(category)?.bestVersion,
            changeDescription,
        );
        this.saveSkillVersion(category, restoredSkill);
        this.promoteSkill(category, restoredSkill.metadata.version);
        this.updateSkillCategoryMetadata(category, {
            enabled     : true,
            userDeleted : false,
            userModified: false,
        });
        return restoredSkill;
    }

    /**
     * Returns the raw markdown content of a specific version,
     * or null if the version does not exist.
     */
    public loadSkillContent(category: string, version: number): string | null {
        return this.loadSkill(category, version)?.content ?? null;
    }

    public rollbackSkill(category: string, targetVersion: number): boolean {
        const metadata = this.loadMetadata(category);
        if (metadata) {
            const versionInfo = metadata.versions.find(v => v.version === targetVersion);
            if (versionInfo) {
                metadata.bestVersion = targetVersion;
                this.saveMetadata(category, metadata);
                return true;
            }
        }
        return false;
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

    public promoteSkill(category: string, version: number, score?: number): void {
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
            if (score !== undefined) {
                versionInfo.score = score;
            }
            metadata.bestVersion = version;
            this.saveMetadata(category, metadata);
        }
    }

}
