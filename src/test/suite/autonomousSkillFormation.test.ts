import * as assert from 'assert';
import { suite, test } from 'mocha';
import { AutonomousSkillFormation } from '../../services/skillOpt/autonomousSkillFormation';
import { VectorStore } from '../../services/memory/VectorStore';
import { LLMGateway } from '../../services/llmGateway';
import { SkillValidator } from '../../services/skillOpt/skillValidator';
import { SkillRegistry } from '../../services/skillOpt/skillRegistry';

suite('Autonomous Skill Formation Tests', () => {

    test('should ignore when no high-confidence procedural memories exist', async () => {
        const vectorStore = VectorStore.getInstance();
        const originalGetAll = vectorStore.getAllMemories;
        vectorStore.getAllMemories = async () => ([
            {
                id: 'mem1',
                type: 'procedural',
                task: 'Some task',
                content: 'Strategy 1',
                confidence: 0.5, // Too low
                metadata: { successCount: 1, createdBy: 'agent' },
                timestamp: Date.now()
            } as any
        ]);

        const llmGateway = LLMGateway.getInstance();
        let generateCalled = false;
        const originalStreamChat = llmGateway.streamChat;
        llmGateway.streamChat = async () => { generateCalled = true; };

        const autonomousFormation = AutonomousSkillFormation.getInstance('/tmp');
        await autonomousFormation.evaluatePatterns();

        assert.strictEqual(generateCalled, false);

        // Restore
        vectorStore.getAllMemories = originalGetAll;
        llmGateway.streamChat = originalStreamChat;
    });

    test('should process high-confidence procedural memories into skills', async () => {
        const vectorStore = VectorStore.getInstance();
        const originalGetAll = vectorStore.getAllMemories;
        vectorStore.getAllMemories = async () => ([
            {
                id: 'mem2',
                type: 'procedural',
                task: 'Fix React component bug',
                content: 'Discover component, fix bug, test',
                confidence: 0.95,
                metadata: { successCount: 4, createdBy: 'agent' },
                timestamp: Date.now()
            } as any
        ]);

        const llmGateway = LLMGateway.getInstance();
        const originalStreamChat = llmGateway.streamChat;
        llmGateway.streamChat = async (params: any) => {
            const output = `---
name: React Component Fix
description: General react fix
---
1. Fix
`;
            for (const char of output) {
                params.callbacks.onChunk(char);
            }
            params.callbacks.onComplete();
        };

        const skillValidator = SkillValidator.getInstance();
        const originalValidate = skillValidator.validateCandidate;
        skillValidator.validateCandidate = async () => ({ score: 0.9, reasoning: 'Valid' });

        const skillRegistry = SkillRegistry.getInstance('/tmp');
        const originalCreate = skillRegistry.createSkillVersion;
        let createdName = '';
        let createdContent = '';
        skillRegistry.createSkillVersion = (name, content, _parent, _desc) => {
            createdName = name;
            createdContent = content;
            return {} as any;
        };

        const autonomousFormation = AutonomousSkillFormation.getInstance('/tmp');
        await autonomousFormation.evaluatePatterns();

        assert.strictEqual(createdName, 'react-component-fix');
        assert.ok(createdContent.includes('name: React Component Fix'));

        // Restore
        vectorStore.getAllMemories = originalGetAll;
        llmGateway.streamChat = originalStreamChat;
        skillValidator.validateCandidate = originalValidate;
        skillRegistry.createSkillVersion = originalCreate;
    });
});
