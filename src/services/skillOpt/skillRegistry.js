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
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
var SkillRegistry = /** @class */ (function () {
    function SkillRegistry(workspaceRoot) {
        this.skillsDir = path.join(workspaceRoot, '.agents', 'skills');
        if (!fs.existsSync(this.skillsDir)) {
            fs.mkdirSync(this.skillsDir, { recursive: true });
        }
    }
    SkillRegistry.getInstance = function (workspaceRoot) {
        if (!SkillRegistry.instance) {
            SkillRegistry.instance = new SkillRegistry(workspaceRoot);
        }
        return SkillRegistry.instance;
    };
    SkillRegistry.resetInstance = function () {
        SkillRegistry.instance = undefined;
    };
    SkillRegistry.prototype.listSkills = function () {
        var _this = this;
        if (!fs.existsSync(this.skillsDir))
            return [];
        return fs.readdirSync(this.skillsDir).filter(function (f) { return fs.statSync(path.join(_this.skillsDir, f)).isDirectory(); });
    };
    SkillRegistry.prototype.loadMetadata = function (category) {
        var metadataPath = path.join(this.skillsDir, category, 'metadata.json');
        if (fs.existsSync(metadataPath)) {
            return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        }
        return null;
    };
    SkillRegistry.prototype.saveMetadata = function (category, metadata) {
        var categoryDir = path.join(this.skillsDir, category);
        if (!fs.existsSync(categoryDir)) {
            fs.mkdirSync(categoryDir, { recursive: true });
        }
        var metadataPath = path.join(categoryDir, 'metadata.json');
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    };
    SkillRegistry.prototype.loadSkill = function (category, version) {
        var metadata = this.loadMetadata(category);
        if (!metadata)
            return null;
        var versionInfo = metadata.versions.find(function (v) { return v.version === version; });
        if (!versionInfo)
            return null;
        var skillPath = path.join(this.skillsDir, category, "skill_v".concat(version, ".md"));
        if (fs.existsSync(skillPath)) {
            var content = fs.readFileSync(skillPath, 'utf8');
            return { metadata: versionInfo, content: content };
        }
        return null;
    };
    SkillRegistry.prototype.getBestSkill = function (category) {
        var metadata = this.loadMetadata(category);
        if (!metadata || !metadata.bestVersion)
            return null;
        return this.loadSkill(category, metadata.bestVersion);
    };
    SkillRegistry.prototype.createSkillVersion = function (category, content, parentVersion, changeDescription) {
        var metadata = this.loadMetadata(category) || {
            skillName: category,
            bestVersion: 0,
            versions: []
        };
        var nextVersion = metadata.versions.length > 0
            ? Math.max.apply(Math, metadata.versions.map(function (v) { return v.version; })) + 1
            : 1;
        var versionInfo = {
            version: nextVersion,
            parentVersion: parentVersion,
            status: 'draft',
            createdAt: Date.now(),
            changeDescription: changeDescription
        };
        return {
            metadata: versionInfo,
            content: content
        };
    };
    SkillRegistry.prototype.saveSkillVersion = function (category, skill) {
        var categoryDir = path.join(this.skillsDir, category);
        if (!fs.existsSync(categoryDir)) {
            fs.mkdirSync(categoryDir, { recursive: true });
        }
        var metadata = this.loadMetadata(category) || {
            skillName: category,
            bestVersion: 0,
            versions: []
        };
        var existingIdx = metadata.versions.findIndex(function (v) { return v.version === skill.metadata.version; });
        if (existingIdx >= 0) {
            // We never overwrite historical versions if they are already saved (except updating status)
            // But if we are creating a new one, we save it.
            metadata.versions[existingIdx] = skill.metadata;
        }
        else {
            metadata.versions.push(skill.metadata);
        }
        var skillPath = path.join(categoryDir, "skill_v".concat(skill.metadata.version, ".md"));
        // Only write file if it doesn't exist to protect history, or if it's draft being updated
        if (!fs.existsSync(skillPath) || skill.metadata.status === 'draft') {
            fs.writeFileSync(skillPath, skill.content, 'utf8');
        }
        this.saveMetadata(category, metadata);
    };
    SkillRegistry.prototype.promoteSkill = function (category, version) {
        var metadata = this.loadMetadata(category);
        if (!metadata)
            return;
        var versionInfo = metadata.versions.find(function (v) { return v.version === version; });
        if (versionInfo) {
            // Demote previous best
            if (metadata.bestVersion) {
                var prevBest = metadata.versions.find(function (v) { return v.version === metadata.bestVersion; });
                if (prevBest)
                    prevBest.status = 'archived';
            }
            versionInfo.status = 'best';
            metadata.bestVersion = version;
            this.saveMetadata(category, metadata);
        }
    };
    SkillRegistry.prototype.rollbackSkill = function (category, versionToRollbackTo) {
        var metadata = this.loadMetadata(category);
        if (!metadata)
            return;
        var versionInfo = metadata.versions.find(function (v) { return v.version === versionToRollbackTo; });
        if (versionInfo) {
            if (metadata.bestVersion) {
                var prevBest = metadata.versions.find(function (v) { return v.version === metadata.bestVersion; });
                if (prevBest)
                    prevBest.status = 'archived';
            }
            versionInfo.status = 'best';
            metadata.bestVersion = versionToRollbackTo;
            this.saveMetadata(category, metadata);
        }
    };
    return SkillRegistry;
}());
exports.SkillRegistry = SkillRegistry;
