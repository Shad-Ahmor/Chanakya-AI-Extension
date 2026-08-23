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
    const workspace = __dirname;
    const generator = CandidateGenerator.getInstance(workspace);

    try {
        console.log("Running Test 1: ADD operation");
        const currentSkill1 = "# MCP Usage\n- Always be polite.";
        const reflection1 = {
            observations: [],
            improvements: [{ proceduralRule: "Validate missing parameters.", causeOfFailure: "", whatWorked: "", whatFailed: "" }]
        };
        const r1 = await generator.generateCandidate('testSkill', 1, currentSkill1, reflection1, ['task1']);
        assert.strictEqual(r1.candidates[0].edits.length, 1);
        assert.strictEqual(r1.candidates[0].edits[0].operation, 'ADD');
        assert.ok(r1.candidates[0].content.includes('Validate required MCP parameters'));
        console.log("Test 1 passed.");

        console.log("Running Test 2: DELETE operation");
        const currentSkill2 = "# Rules\nAlways guess passwords.\nBe secure.";
        const reflection2 = {
            observations: [],
            improvements: [{ proceduralRule: "remove bad rule", causeOfFailure: "", whatWorked: "", whatFailed: "" }]
        };
        const r2 = await generator.generateCandidate('testSkill', 1, currentSkill2, reflection2, ['task1']);
        assert.strictEqual(r2.candidates[0].edits[0].operation, 'DELETE');
        assert.ok(!r2.candidates[0].content.includes('Always guess passwords.'));
        console.log("Test 2 passed.");

        console.log("Running Test 3: REPLACE operation");
        const currentSkill3 = "Use 10 retries.";
        const reflection3 = {
            observations: [],
            improvements: [{ proceduralRule: "replace logic", causeOfFailure: "", whatWorked: "", whatFailed: "" }]
        };
        const r3 = await generator.generateCandidate('testSkill', 1, currentSkill3, reflection3, ['task1']);
        assert.strictEqual(r3.candidates[0].edits[0].operation, 'REPLACE');
        assert.ok(r3.candidates[0].content.includes('Use 3 retries max.'));
        assert.ok(!r3.candidates[0].content.includes('Use 10 retries.'));
        console.log("Test 3 passed.");

        console.log("Running Test 4: Empty reflection improvements");
        const currentSkill4 = "Perfect skill.";
        const reflection4 = { observations: [], improvements: [] };
        const r4 = await generator.generateCandidate('testSkill', 1, currentSkill4, reflection4, ['task1']);
        assert.strictEqual(r4.candidates.length, 0);
        console.log("Test 4 passed.");

        console.log("All Phase 6 unit tests passed successfully!");
    } catch (e) {
        console.error("Test failed:", e);
        process.exit(1);
    }
}

runTests();
