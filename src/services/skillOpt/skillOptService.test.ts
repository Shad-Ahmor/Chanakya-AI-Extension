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

import { TaskApplicabilityValidator } from './taskApplicabilityValidator';

const mockAIService = {
    streamCompletion: (params: any) => {
        const prompt = params.prompt as string;
        if (prompt.includes('expert AI agent behavior analyst')) {
            const fakeResponse = {
                observations: [{ problem: "Missing parameters", evidenceCount: 3 }],
                improvements: [{ instruction: "Validate parameters." }]
            };
            params.callbacks.onComplete(JSON.stringify(fakeResponse));
        } else {
            const fakeResponse = [
                { operation: 'ADD', section: '# Rules', content: 'Validate parameters before use.' }
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
    console.log("Starting Semantic Lifecycle Unit Tests (SkillOptService)...");
    
    const testWorkspace = path.join(__dirname, 'test_workspace_semantic');
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
        const service = SkillOptService.getInstance(testWorkspace);

        // Helper to mock the Applicability Validator
        const mockValidator = (applicable: 'YES' | 'NO' | 'UNCERTAIN', reasonCode: any = 'TASK_VALID') => {
            TaskApplicabilityValidator.getInstance().validate = async () => ({
                applicable,
                reason: 'Mock validation',
                reasonCode,
                evidence: []
            });
        };

        // --- CASE 1: Target does not exist (TASK_NOT_APPLICABLE) ---
        console.log("Running Case 1: Target does not exist");
        recorder.startTask('mock-case-1', 'Do something', 'coding', 1);
        recorder.endTask('mock-case-1', true);
        mockValidator('NO', 'TASK_TARGET_NOT_FOUND');
        const case1Result = await service.optimize('coding', async () => 0.95);
        assert.strictEqual(case1Result.task.status, 'TASK_NOT_APPLICABLE');
        assert.strictEqual(case1Result.candidate.status, 'CANDIDATE_NOT_CREATED');
        assert.strictEqual(case1Result.optimization.decision, 'NOT_EVALUATED');

        // --- CASE 6: Two targets (TASK_NEEDS_CLARIFICATION) ---
        console.log("Running Case 6: Task Ambiguous");
        recorder.startTask('mock-case-6', 'Do something', 'coding', 1);
        recorder.endTask('mock-case-6', true);
        mockValidator('UNCERTAIN', 'TASK_NEEDS_CLARIFICATION');
        const case6Result = await service.optimize('coding', async () => 0.95);
        assert.strictEqual(case6Result.task.status, 'TASK_NEEDS_CLARIFICATION');
        assert.strictEqual(case6Result.optimization.decision, 'NOT_EVALUATED');

        // --- CASE 7: Target blocked (TASK_BLOCKED) ---
        console.log("Running Case 7: Task Blocked");
        recorder.startTask('mock-case-7', 'Do something', 'coding', 1);
        recorder.endTask('mock-case-7', true);
        mockValidator('NO', 'MCP_PERMISSION_DENIED');
        const case7Result = await service.optimize('coding', async () => 0.95);
        assert.strictEqual(case7Result.task.status, 'TASK_BLOCKED');
        assert.strictEqual(case7Result.optimization.decision, 'NOT_EVALUATED');

        // Revert mock for the rest
        mockValidator('YES', 'TASK_VALID');

        // --- CASE 2: Candidate Generation Fails ---
        console.log("Running Case 2: Candidate Generation Fails");
        recorder.startTask('mock-case-2', 'Do something', 'coding', 1);
        recorder.endTask('mock-case-2', true);
        
        // Temporarily break CandidateGenerator
        const CandidateGeneratorModule = require('./candidateGenerator');
        const originalGen = CandidateGeneratorModule.CandidateGenerator.getInstance;
        CandidateGeneratorModule.CandidateGenerator.getInstance = () => ({
            generateCandidate: async () => { throw new Error('Generation failed'); }
        });
        
        const case2Result = await service.optimize('coding', async () => 0.95);
        assert.strictEqual(case2Result.task.status, 'TASK_FAILED');
        assert.strictEqual(case2Result.task.reasonCode, 'CANDIDATE_GENERATION_FAILED');
        assert.strictEqual(case2Result.candidate.status, 'CANDIDATE_GENERATION_FAILED');
        assert.strictEqual(case2Result.optimization.decision, 'NOT_EVALUATED');
        
        // Restore Generator
        CandidateGeneratorModule.CandidateGenerator.getInstance = originalGen;

        // --- CASE 3: Evaluation Fails (Crash) ---
        console.log("Running Case 3: Evaluation Fails");
        recorder.startTask('mock-case-3', 'Do something', 'coding', 1);
        recorder.endTask('mock-case-3', true);
        const case3Result = await service.optimize('coding', async () => { throw new Error('Test crash'); });
        assert.strictEqual(case3Result.task.status, 'TASK_FAILED');
        assert.strictEqual(case3Result.task.reasonCode, 'EVALUATION_FAILED');
        assert.strictEqual(case3Result.candidate.status, 'CANDIDATE_APPLIED');
        assert.strictEqual(case3Result.evaluation.status, 'EVALUATION_FAILED');
        assert.strictEqual(case3Result.optimization.decision, 'NOT_EVALUATED');

        // --- CASE 4: Candidate Worse (REJECTED) ---
        console.log("Running Case 4: Candidate Worse");
        recorder.startTask('mock-case-4', 'Do something', 'coding', 1);
        recorder.endTask('mock-case-4', true);
        const case4Result = await service.optimize('coding', async () => 0.20); // Baseline is 0
        // Wait, baseline score in test was calculated as 0, let's assume validationRunner returns negative to be worse.
        // Actually, validation gate rejects if not strictly greater.
        assert.strictEqual(case4Result.candidate.status, 'CANDIDATE_REJECTED');
        assert.strictEqual(case4Result.optimization.decision, 'REJECTED');

        // --- CASE 5: Candidate Better (ACCEPTED) ---
        console.log("Running Case 5: Candidate Better");
        recorder.startTask('mock-case-5', 'Do something', 'coding', 1); // Version is still 1 since previous was rejected
        recorder.endTask('mock-case-5', true);
        const case5Result = await service.optimize('coding', async () => 0.99);
        assert.strictEqual(case5Result.candidate.status, 'CANDIDATE_ACCEPTED');
        assert.strictEqual(case5Result.optimization.decision, 'ACCEPTED');

        console.log("All Semantic Lifecycle unit tests passed successfully!");
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
