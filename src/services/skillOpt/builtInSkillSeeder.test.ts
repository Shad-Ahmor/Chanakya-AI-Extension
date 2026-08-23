import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { SkillRegistry } from './skillRegistry';
import { BuiltInSkillSeeder } from './builtInSkillSeeder';

describe('BuiltInSkillSeeder', () => {
    let testWorkspace: string;

    beforeEach(async () => {
        testWorkspace = path.join(os.tmpdir(), 'chanakya-test-seeder-' + Date.now());
        await fs.mkdir(testWorkspace, { recursive: true });
        SkillRegistry.resetInstance();
    });

    afterEach(async () => {
        await fs.rm(testWorkspace, { recursive: true, force: true });
    });

    it('should seed skills on first install', () => {
        const registry = SkillRegistry.getInstance(testWorkspace);
        BuiltInSkillSeeder.seedSkills(registry);

        const skills = registry.listSkills();
        expect(skills).to.include('react-basics');
        expect(skills).to.include('typescript-core');

        const meta = registry.getSkillCategoryMetadata('react-basics');
        expect(meta?.builtIn).to.be.true;
        expect(meta?.sourceVersion).to.equal('v1');
    });

    it('should not duplicate skills on second startup', () => {
        const registry = SkillRegistry.getInstance(testWorkspace);
        BuiltInSkillSeeder.seedSkills(registry);
        
        let meta = registry.getSkillCategoryMetadata('react-basics');
        expect(meta?.versions.length).to.equal(1);

        // Run seeder again
        BuiltInSkillSeeder.seedSkills(registry);
        meta = registry.getSkillCategoryMetadata('react-basics');
        // Should still be exactly 1 version (idempotent)
        expect(meta?.versions.length).to.equal(1);
    });

    it('should preserve existing user-modified skills', () => {
        const registry = SkillRegistry.getInstance(testWorkspace);
        
        // Seed first
        BuiltInSkillSeeder.seedSkills(registry);
        
        // Simulate user creating a new version
        const newVer = registry.createSkillVersion('react-basics', '# Custom Content', 1, 'User modified');
        registry.saveSkillVersion('react-basics', newVer);
        registry.promoteSkill('react-basics', newVer.metadata.version);

        let meta = registry.getSkillCategoryMetadata('react-basics');
        expect(meta?.versions.length).to.equal(2);
        expect(meta?.bestVersion).to.equal(2);

        // Run seeder again
        BuiltInSkillSeeder.seedSkills(registry);
        
        meta = registry.getSkillCategoryMetadata('react-basics');
        // Should still be 2, seeder didn't overwrite or duplicate
        expect(meta?.versions.length).to.equal(2);
        expect(meta?.bestVersion).to.equal(2);
        
        const bestSkill = registry.getBestSkill('react-basics');
        expect(bestSkill?.content).to.equal('# Custom Content');
    });
});
