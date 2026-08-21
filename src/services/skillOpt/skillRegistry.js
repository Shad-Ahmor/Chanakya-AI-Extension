"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillRegistry = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class SkillRegistry {
    static instance;
    skillsDir;
    constructor(workspaceRoot) {
        this.skillsDir = path.join(workspaceRoot, '.agents', 'skills');
        if (!fs.existsSync(this.skillsDir)) {
            fs.mkdirSync(this.skillsDir, { recursive: true });
        }
    }
    static getInstance(workspaceRoot) {
        if (!SkillRegistry.instance) {
            SkillRegistry.instance = new SkillRegistry(workspaceRoot);
        }
        return SkillRegistry.instance;
    }
    static resetInstance() {
        SkillRegistry.instance = undefined;
    }
    listSkills() {
        if (!fs.existsSync(this.skillsDir))
            return [];
        return fs.readdirSync(this.skillsDir).filter(f => fs.statSync(path.join(this.skillsDir, f)).isDirectory());
    }
    loadMetadata(category) {
        const metadataPath = path.join(this.skillsDir, category, 'metadata.json');
        if (fs.existsSync(metadataPath)) {
            return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        }
        return null;
    }
    saveMetadata(category, metadata) {
        const categoryDir = path.join(this.skillsDir, category);
        if (!fs.existsSync(categoryDir)) {
            fs.mkdirSync(categoryDir, { recursive: true });
        }
        const metadataPath = path.join(categoryDir, 'metadata.json');
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    }
    loadSkill(category, version) {
        const metadata = this.loadMetadata(category);
        if (!metadata)
            return null;
        const versionInfo = metadata.versions.find(v => v.version === version);
        if (!versionInfo)
            return null;
        const skillPath = path.join(this.skillsDir, category, `skill_v${version}.md`);
        if (fs.existsSync(skillPath)) {
            const content = fs.readFileSync(skillPath, 'utf8');
            return { metadata: versionInfo, content };
        }
        return null;
    }
    getBestSkill(category) {
        const metadata = this.loadMetadata(category);
        if (!metadata || !metadata.bestVersion)
            return null;
        return this.loadSkill(category, metadata.bestVersion);
    }
    createSkillVersion(category, content, parentVersion, changeDescription) {
        const metadata = this.loadMetadata(category) || {
            skillName: category,
            bestVersion: 0,
            versions: []
        };
        const nextVersion = metadata.versions.length > 0
            ? Math.max(...metadata.versions.map(v => v.version)) + 1
            : 1;
        const versionInfo = {
            version: nextVersion,
            status: 'draft',
            createdAt: Date.now()
        };
        if (parentVersion !== undefined)
            versionInfo.parentVersion = parentVersion;
        if (changeDescription !== undefined)
            versionInfo.changeDescription = changeDescription;
        return {
            metadata: versionInfo,
            content
        };
    }
    saveSkillVersion(category, skill) {
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
        }
        else {
            metadata.versions.push(skill.metadata);
        }
        const skillPath = path.join(categoryDir, `skill_v${skill.metadata.version}.md`);
        // Only write file if it doesn't exist to protect history, or if it's draft being updated
        if (!fs.existsSync(skillPath) || skill.metadata.status === 'draft') {
            fs.writeFileSync(skillPath, skill.content, 'utf8');
        }
        this.saveMetadata(category, metadata);
    }
    promoteSkill(category, version) {
        const metadata = this.loadMetadata(category);
        if (!metadata)
            return;
        const versionInfo = metadata.versions.find(v => v.version === version);
        if (versionInfo) {
            // Demote previous best
            if (metadata.bestVersion) {
                const prevBest = metadata.versions.find(v => v.version === metadata.bestVersion);
                if (prevBest)
                    prevBest.status = 'archived';
            }
            versionInfo.status = 'best';
            metadata.bestVersion = version;
            this.saveMetadata(category, metadata);
        }
    }
    rollbackSkill(category, versionToRollbackTo) {
        const metadata = this.loadMetadata(category);
        if (!metadata)
            return;
        const versionInfo = metadata.versions.find(v => v.version === versionToRollbackTo);
        if (versionInfo) {
            if (metadata.bestVersion) {
                const prevBest = metadata.versions.find(v => v.version === metadata.bestVersion);
                if (prevBest)
                    prevBest.status = 'archived';
            }
            versionInfo.status = 'best';
            metadata.bestVersion = versionToRollbackTo;
            this.saveMetadata(category, metadata);
        }
    }
}
exports.SkillRegistry = SkillRegistry;
//# sourceMappingURL=skillRegistry.js.map