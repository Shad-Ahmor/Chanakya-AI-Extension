import { SkillRegistry } from './skillRegistry';
import * as path from 'path';
import * as fs from 'fs';
import * as assert from 'assert';

async function runTests() {
    console.log("Starting Phase 2 Unit Tests...");
    
    const testWorkspace = path.join(__dirname, 'test_workspace_phase2');
    if (fs.existsSync(testWorkspace)) {
        fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
    
    SkillRegistry.resetInstance();
    const registry = SkillRegistry.getInstance(testWorkspace);

    try {
        const category = 'coding';

        // 1. Create v1
        console.log("Running Test 1: Create v1");
        const skillV1 = registry.createSkillVersion(category, '# Version 1 Content', undefined, 'Initial version');
        assert.strictEqual(skillV1.metadata.version, 1);
        registry.saveSkillVersion(category, skillV1);
        registry.promoteSkill(category, 1);
        console.log("Test 1 passed.");

        // 2. Create v2
        console.log("Running Test 2: Create v2");
        const skillV2 = registry.createSkillVersion(category, '# Version 2 Content', 1, 'Improved loops');
        assert.strictEqual(skillV2.metadata.version, 2);
        assert.strictEqual(skillV2.metadata.parentVersion, 1);
        registry.saveSkillVersion(category, skillV2);
        registry.promoteSkill(category, 2);
        console.log("Test 2 passed.");

        // 3. Both versions remain available
        console.log("Running Test 3: Both versions remain available");
        const loadedV1 = registry.loadSkill(category, 1);
        const loadedV2 = registry.loadSkill(category, 2);
        assert.ok(loadedV1 && loadedV2);
        assert.strictEqual(loadedV1!.content, '# Version 1 Content');
        assert.strictEqual(loadedV2!.content, '# Version 2 Content');
        console.log("Test 3 passed.");

        // 4. Best version can be selected
        console.log("Running Test 4: Best version can be selected");
        const best = registry.getBestSkill(category);
        assert.ok(best);
        assert.strictEqual(best!.metadata.version, 2);
        assert.strictEqual(best!.metadata.status, 'best');
        console.log("Test 4 passed.");

        // 5. Rollback works
        console.log("Running Test 5: Rollback works");
        registry.rollbackSkill(category, 1);
        const newBest = registry.getBestSkill(category);
        assert.ok(newBest);
        assert.strictEqual(newBest!.metadata.version, 1);
        assert.strictEqual(newBest!.metadata.status, 'best');
        
        // Verify v2 is archived
        const checkV2 = registry.loadSkill(category, 2);
        assert.strictEqual(checkV2!.metadata.status, 'archived');
        console.log("Test 5 passed.");

        // 6. Historical versions are never deleted
        console.log("Running Test 6: Historical versions are never deleted");
        const files = fs.readdirSync(path.join(testWorkspace, '.agents', 'skills', category));
        assert.ok(files.includes('skill_v1.md'));
        assert.ok(files.includes('skill_v2.md'));
        assert.ok(files.includes('metadata.json'));
        console.log("Test 6 passed.");

        // Extra: Test listSkills
        const skillsList = registry.listSkills();
        assert.ok(skillsList.includes(category));

        console.log("All Phase 2 unit tests passed successfully!");
    } catch (e) {
        console.error("Test failed:", e);
        process.exit(1);
    } finally {
        if (fs.existsSync(testWorkspace)) {
            fs.rmSync(testWorkspace, { recursive: true, force: true });
        }
    }
}

runTests();
