const fs = require('fs');
const path = require('path');
const { SkillRegistry } = require('../out/src/services/skillOpt/skillRegistry');
const { BuiltInSkillSeeder } = require('../out/src/services/skillOpt/builtInSkillSeeder');

const workspaceRoot = path.join(__dirname, 'testWorkspace');
if (!fs.existsSync(workspaceRoot)) fs.mkdirSync(workspaceRoot, { recursive: true });

try {
    const registry = SkillRegistry.getInstance(workspaceRoot);
    BuiltInSkillSeeder.seedSkills(registry);
    const reactSkill = registry.getSkillCategoryMetadata('react');
    console.log("React Skill:", !!reactSkill);
} catch (e) {
    console.error(e);
}
