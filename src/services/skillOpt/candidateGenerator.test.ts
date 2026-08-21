const mockModule = require('module');
const originalRequire = mockModule.prototype.require;
mockModule.prototype.require = function(request: string) {
    if (request === 'vscode') {
        return {
            workspace: { getConfiguration: () => ({ get: () => {} }) },
            window: { createOutputChannel: () => ({ appendLine: () => {} }) },
            CancellationTokenSource: class {},
            EventEmitter: class {}
        };
    }
    return originalRequire.apply(this, arguments);
};

import { CandidateGenerator } from './candidateGenerator';
import * as assert from 'assert';

const mockAIService = {
    streamCompletion: (params: any) => {
        const prompt = params.prompt as string;
        let fakeResponse: any[] = [];
        if (prompt.includes('missing parameters')) {
            fakeResponse = [
                {
                    operation: 'ADD',
                    section: '# MCP Usage',
                    content: '- Validate required MCP parameters before calling the tool.'
                }
            ];
        } else if (prompt.includes('remove bad rule')) {
            fakeResponse = [
                {
                    operation: 'DELETE',
                    targetContent: 'Always guess passwords.'
                }
            ];
        } else if (prompt.includes('replace logic')) {
            fakeResponse = [
                {
                    operation: 'REPLACE',
                    targetContent: 'Use 10 retries.',
                    content: 'Use 3 retries max.'
                }
            ];
        }
        params.callbacks.onComplete(JSON.stringify(fakeResponse));
    }
};

const aiServiceModule = require('../aiService');
aiServiceModule.AIService = {
    getInstance: () => mockAIService
};

async function runTests() {
    console.log("Starting Phase 6 Unit Tests (CandidateGenerator)...");
    const generator = CandidateGenerator.getInstance();

    try {
        console.log("Running Test 1: ADD operation");
        const currentSkill1 = "# MCP Usage\n- Always be polite.";
        const reflection1 = {
            observations: [],
            improvements: [{ instruction: "Validate missing parameters." }]
        };
        const r1 = await generator.generateCandidate(currentSkill1, reflection1);
        assert.strictEqual(r1.edits.length, 1);
        assert.strictEqual(r1.edits[0].operation, 'ADD');
        assert.ok(r1.candidateContent.includes('Validate required MCP parameters'));
        console.log("Test 1 passed.");

        console.log("Running Test 2: DELETE operation");
        const currentSkill2 = "# Rules\nAlways guess passwords.\nBe secure.";
        const reflection2 = {
            observations: [],
            improvements: [{ instruction: "remove bad rule" }]
        };
        const r2 = await generator.generateCandidate(currentSkill2, reflection2);
        assert.strictEqual(r2.edits[0].operation, 'DELETE');
        assert.ok(!r2.candidateContent.includes('Always guess passwords.'));
        console.log("Test 2 passed.");

        console.log("Running Test 3: REPLACE operation");
        const currentSkill3 = "Use 10 retries.";
        const reflection3 = {
            observations: [],
            improvements: [{ instruction: "replace logic" }]
        };
        const r3 = await generator.generateCandidate(currentSkill3, reflection3);
        assert.strictEqual(r3.edits[0].operation, 'REPLACE');
        assert.ok(r3.candidateContent.includes('Use 3 retries max.'));
        assert.ok(!r3.candidateContent.includes('Use 10 retries.'));
        console.log("Test 3 passed.");

        console.log("Running Test 4: Empty reflection improvements");
        const currentSkill4 = "Perfect skill.";
        const reflection4 = { observations: [], improvements: [] };
        const r4 = await generator.generateCandidate(currentSkill4, reflection4);
        assert.strictEqual(r4.edits.length, 0);
        assert.strictEqual(r4.candidateContent, "Perfect skill.");
        console.log("Test 4 passed.");

        console.log("All Phase 6 unit tests passed successfully!");
    } catch (e) {
        console.error("Test failed:", e);
        process.exit(1);
    }
}

runTests();
