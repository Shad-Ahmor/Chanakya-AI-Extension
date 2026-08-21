const mockModule = require('module');
const originalRequire = mockModule.prototype.require;
mockModule.prototype.require = function(request: string) {
    if (request === 'vscode') {
        return {
            workspace: { getConfiguration: () => ({ get: () => {} }) },
            CancellationTokenSource: class {},
            EventEmitter: class {}
        };
    }
    return originalRequire.apply(this, arguments);
};

import { ReflectionEngine } from './reflectionEngine';
import { Trajectory } from './trajectoryRecorder';
import * as assert from 'assert';

// Mock AIService globally before testing
const mockAIService = {
    streamCompletion: (params: any) => {
        const prompt = params.prompt as string;
        if (prompt.includes('missing_param')) {
            const fakeResponse = {
                observations: [
                    { problem: "Missing required parameters in search tool", evidenceCount: 3 }
                ],
                improvements: [
                    { instruction: "Always validate required parameters before calling search tool." }
                ]
            };
            params.callbacks.onComplete(JSON.stringify(fakeResponse));
        } else {
            params.callbacks.onComplete(JSON.stringify({ observations: [], improvements: [] }));
        }
    }
};
const aiServiceModule = require('../aiService');
aiServiceModule.AIService = {
    getInstance: () => mockAIService
};

function createMockTrajectory(overrides: Partial<Trajectory>): Trajectory {
    return {
        taskId: 'mock-' + Math.random(),
        task: 'Do something',
        skill: 'coding',
        skillVersion: 1,
        toolCalls: [],
        retries: 0,
        success: true,
        durationMs: 1000,
        timestamp: Date.now(),
        ...overrides
    };
}

async function runTests() {
    console.log("Starting Phase 5 Unit Tests (ReflectionEngine)...");
    const engine = ReflectionEngine.getInstance();

    try {
        console.log("Running Test 1: Empty trajectories");
        const r1 = await engine.reflect([]);
        assert.deepStrictEqual(r1, { observations: [], improvements: [] });
        console.log("Test 1 passed.");

        console.log("Running Test 2: Identify repeated problems");
        const trajectories = [
            createMockTrajectory({
                toolCalls: [{ toolName: 'search', args: { missing_param: true }, success: false, error: 'missing query' }]
            }),
            createMockTrajectory({
                toolCalls: [{ toolName: 'search', args: { missing_param: true }, success: false, error: 'missing query' }]
            }),
            createMockTrajectory({
                toolCalls: [{ toolName: 'search', args: { missing_param: true }, success: false, error: 'missing query' }]
            })
        ];

        const r2 = await engine.reflect(trajectories);
        assert.strictEqual(r2.observations.length, 1);
        assert.strictEqual(r2.observations[0].evidenceCount, 3);
        assert.strictEqual(r2.improvements.length, 1);
        assert.ok(r2.improvements[0].instruction.includes('validate'));
        console.log("Test 2 passed.");

        console.log("All Phase 5 unit tests passed successfully!");
    } catch (e) {
        console.error("Test failed:", e);
        process.exit(1);
    }
}

runTests();
