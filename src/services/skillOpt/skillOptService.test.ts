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

import { SkillOptService } from './skillOptService';
import { SkillRegistry } from './skillRegistry';
import { TrajectoryRecorder } from './trajectoryRecorder';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

const mockAIService = {
    streamCompletion: (params: any) => {
        const prompt = params.prompt as string;
        if (prompt.includes('expert AI agent behavior analyst')) {
            // Mock ReflectionEngine
            const fakeResponse = {
                observations: [
                    { problem: "Missing parameters", evidenceCount: 3 }
                ],
                improvements: [
                    { instruction: "Validate parameters." }
                ]
            };
            params.callbacks.onComplete(JSON.stringify(fakeResponse));
        } else {
            // Mock CandidateGenerator
            const fakeResponse = [
                {
                    operation: 'ADD',
                    section: '# Rules',
                    content: 'Validate parameters before use.'
                }
            ];
            params.callbacks.onComplete(JSON.stringify(fakeResponse));
        }
    }
};

const aiServiceModule = require('../aiService');
aiServiceModule.AIService = {
    getInstance: () => mockAIService
};

async function runTests() {
    console.log("Starting Phase 9 Unit Tests (SkillOptService E2E)...");
    
    const testWorkspace = path.join(__dirname, 'test_workspace_phase9');
    if (fs.existsSync(testWorkspace)) {
        fs.rmSync(testWorkspace, { recursive: true, force: true });
    }

    try {
        SkillOptService.resetInstance();
        
        const registry = SkillRegistry.getInstance(testWorkspace);
        const initSkill = registry.createSkillVersion('coding', '# Rules\nDo code.', 0, 'Initial');
        registry.saveSkillVersion('coding', initSkill);
        registry.promoteSkill('coding', initSkill.metadata.version);
        
        const recorder = TrajectoryRecorder.getInstance(testWorkspace);
        
        // Create a fake trajectory
        recorder.startTask('mock-task-1', 'Do something', 'coding', 1);
        recorder.recordToolCall('mock-task-1', 'search', {}, undefined, 'error param');
        recorder.endTask('mock-task-1', true);

        const service = SkillOptService.getInstance(testWorkspace);

        // Test 1: Acceptance Loop
        console.log("Running Test 1: Full Loop -> ACCEPT");
        const acceptedResult = await service.optimize('coding', async () => {
            // Mocking a successful validation run returning a much higher score
            return 0.95; 
        });

        assert.strictEqual(acceptedResult.decision, 'accepted');
        assert.strictEqual(acceptedResult.skill, 'coding');
        assert.strictEqual(acceptedResult.previousVersion, 1);
        assert.strictEqual(acceptedResult.candidateVersion, 2);
        assert.ok(acceptedResult.scoreBefore < 0.95);
        assert.ok(acceptedResult.changes.length > 0);
        
        // Verify registry promoted it
        const bestSkillAfterAccept = registry.getBestSkill('coding');
        assert.strictEqual(bestSkillAfterAccept?.metadata.version, 2);
        console.log("Test 1 passed.");

        // Create another fake trajectory for the new best version
        recorder.startTask('mock-task-2', 'Do something else', 'coding', 2);
        recorder.endTask('mock-task-2', true);

        // Test 2: Rejection Loop
        console.log("Running Test 2: Full Loop -> REJECT");
        const rejectedResult = await service.optimize('coding', async () => {
            // Mocking a failed validation run returning a worse score
            return 0.20; 
        });

        assert.strictEqual(rejectedResult.decision, 'rejected');
        assert.strictEqual(rejectedResult.previousVersion, 2);
        assert.strictEqual(rejectedResult.candidateVersion, 3);
        assert.ok(rejectedResult.scoreAfter === 0.20);
        
        // Verify registry did NOT promote it
        const bestSkillAfterReject = registry.getBestSkill('coding');
        assert.strictEqual(bestSkillAfterReject?.metadata.version, 2);
        
        console.log("Test 2 passed.");
        console.log("All Phase 9 unit tests passed successfully!");
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
