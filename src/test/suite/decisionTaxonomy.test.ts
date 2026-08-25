import * as assert from 'assert';
import { TaskApplicabilityValidator, ApplicabilityResult } from '../../services/skillOpt/taskApplicabilityValidator';
import { SkillOptService } from '../../services/skillOpt/skillOptService';
import { TrajectoryRecorder } from '../../services/skillOpt/trajectoryRecorder';
import * as path from 'path';

suite('Decision Taxonomy & Pre-Execution Validation Tests', () => {
    
    // Mocks
    const workspaceRoot = path.join(__dirname, 'mock_workspace');
    
    // A mock LLM wrapper for validator to inject specific deterministic results
    class MockApplicabilityValidator extends TaskApplicabilityValidator {
        private mockResult: ApplicabilityResult;
        
        constructor(mockResult: ApplicabilityResult) {
            super();
            this.mockResult = mockResult;
        }

        public override async validate(_taskDescription: string, _baselineTrajectory: any): Promise<ApplicabilityResult> {
            return this.mockResult;
        }
    }

    test('TEST 1 & 21: Requested component does not exist (Prime Number Calculator Regression)', async () => {
        const validator = new MockApplicabilityValidator({
            applicable: 'NO',
            reasonCode: 'TASK_TARGET_NOT_FOUND',
            reason: 'Repo is a prime number calculator, no dashboard exists.',
            evidence: ['No React files', 'Only prime.js found']
        });
        
        // Inject into singleton
        (TaskApplicabilityValidator as any).instance = validator;

        const recorder = TrajectoryRecorder.getInstance(workspaceRoot);
        // Stub getTrajectories to return our dummy trajectory
        (recorder as any).getTrajectories = () => {
            return [{
                taskId: 'test-task-1',
                task: 'Fix the dashboard statistics component',
                skill: 'react',
                skillVersion: 1,
                toolCalls: [{ toolName: 'test', success: false, output: 'Failed to find dashboard' }],
                success: false
            }];
        };
        
        const service = SkillOptService.getInstance(workspaceRoot);
        
        // We bypass the actual optimize method internals by mocking dependencies, but since we are just 
        // testing the early-exit applicability branch, we can mock `this.registry.getBestSkill` or just 
        // rely on the early return. 
        // Actually, we need to mock registry so it doesn't throw.
        const mockRegistry = {
            getBestSkill: () => ({ metadata: { version: 1 }, content: 'mock' })
        };
        (service as any).registry = mockRegistry;

        const result = await service.optimize('react', async () => 0);
        
        assert.strictEqual(result.task.status, 'TASK_NOT_APPLICABLE');
        assert.strictEqual(result.task.reasonCode, 'TASK_TARGET_NOT_FOUND');
        assert.strictEqual(result.candidate.status, 'CANDIDATE_NOT_CREATED');
        assert.strictEqual(result.evaluation.status, 'EVALUATION_NOT_RUN');
        assert.strictEqual(result.optimization.decision, 'NOT_EVALUATED');
        assert.notStrictEqual(result.decision, 'rejected', "Should NOT be REJECTED!");
    });

    test('TEST 4: MCP permission failure -> TASK_BLOCKED', async () => {
        const validator = new MockApplicabilityValidator({
            applicable: 'BLOCKED',
            reasonCode: 'MCP_PERMISSION_DENIED',
            reason: 'Permission denied writing to /src',
            evidence: []
        });
        (TaskApplicabilityValidator as any).instance = validator;
        
        const recorder = TrajectoryRecorder.getInstance(workspaceRoot);
        (recorder as any).getTrajectories = () => {
            return [{ taskId: 'test-task-4', task: 'mock', skill: 'react', skillVersion: 1, toolCalls: [], success: false }];
        };
        const service = SkillOptService.getInstance(workspaceRoot);
        const result = await service.optimize('react', async () => 0);
        
        assert.strictEqual(result.task.status, 'TASK_BLOCKED');
        assert.strictEqual(result.task.reasonCode, 'MCP_PERMISSION_DENIED');
        assert.strictEqual(result.optimization.decision, 'NOT_EVALUATED');
    });

    test('TEST 5: Multiple possible components -> TASK_NEEDS_CLARIFICATION', async () => {
        const validator = new MockApplicabilityValidator({
            applicable: 'UNCERTAIN',
            reasonCode: 'TASK_NEEDS_CLARIFICATION',
            reason: 'Multiple dashboards found',
            evidence: []
        });
        (TaskApplicabilityValidator as any).instance = validator;
        
        const recorder = TrajectoryRecorder.getInstance(workspaceRoot);
        (recorder as any).getTrajectories = () => {
            return [{ taskId: 'test-task-5', task: 'mock', skill: 'react', skillVersion: 1, toolCalls: [], success: false }];
        };
        const service = SkillOptService.getInstance(workspaceRoot);
        const result = await service.optimize('react', async () => 0);
        
        assert.strictEqual(result.task.status, 'TASK_NEEDS_CLARIFICATION');
        assert.strictEqual(result.task.reasonCode, 'TASK_NEEDS_CLARIFICATION');
        assert.strictEqual(result.optimization.decision, 'NOT_EVALUATED');
    });

    test('Candidate generation failure -> NOT_EVALUATED', async () => {
        const validator = new MockApplicabilityValidator({
            applicable: 'YES',
            reasonCode: 'TASK_VALID',
            reason: 'Valid',
            evidence: []
        });
        (TaskApplicabilityValidator as any).instance = validator;
        const recorder = TrajectoryRecorder.getInstance(workspaceRoot);
        (recorder as any).getTrajectories = () => [{ taskId: 'test-gen-fail', task: 'mock', skill: 'react', skillVersion: 1, toolCalls: [], success: false }];
        const service = SkillOptService.getInstance(workspaceRoot);
        
        // Mock a failure during candidate generation
        (service as any).generator = {
            generateCandidate: async () => { throw new Error('Generation failed'); }
        };
        (service as any).reflection = { reflect: async () => ({ improvements: ['test'] }) };
        
        const result = await service.optimize('react', async () => 0);
        assert.strictEqual(result.task.status, 'TASK_FAILED');
        assert.strictEqual(result.task.reasonCode, 'CANDIDATE_GENERATION_FAILED');
        assert.strictEqual(result.candidate.status, 'CANDIDATE_GENERATION_FAILED');
        assert.strictEqual(result.optimization.decision, 'NOT_EVALUATED');
        assert.notStrictEqual(result.decision, 'rejected'); // Enforce strict rejection rule
    });

    test('Evaluation failure -> NOT_EVALUATED', async () => {
        const validator = new MockApplicabilityValidator({ applicable: 'YES', reasonCode: 'TASK_VALID', reason: 'Valid', evidence: [] });
        (TaskApplicabilityValidator as any).instance = validator;
        const recorder = TrajectoryRecorder.getInstance(workspaceRoot);
        (recorder as any).getTrajectories = () => [{ taskId: 'test-eval-fail', task: 'mock', skill: 'react', skillVersion: 1, toolCalls: [], success: false }];
        const service = SkillOptService.getInstance(workspaceRoot);
        
        (service as any).generator = { generateCandidate: async () => ({ candidates: [{ edits: [{ operation: 'add' }], content: 'mock' }] }) };
        (service as any).reflection = { reflect: async () => ({ improvements: ['test'] }) };
        (service as any).registry.createSkillVersion = () => ({ metadata: { version: 2 }, content: 'mock' });
        (service as any).registry.saveSkillVersion = () => {};
        
        const result = await service.optimize('react', async () => { throw new Error('Eval crash'); });
        
        assert.strictEqual(result.task.status, 'TASK_FAILED');
        assert.strictEqual(result.task.reasonCode, 'EVALUATION_FAILED');
        assert.strictEqual(result.evaluation.status, 'EVALUATION_FAILED');
        assert.strictEqual(result.optimization.decision, 'NOT_EVALUATED');
    });

    test('Candidate accepted -> ACCEPTED', async () => {
        const validator = new MockApplicabilityValidator({ applicable: 'YES', reasonCode: 'TASK_VALID', reason: 'Valid', evidence: [] });
        (TaskApplicabilityValidator as any).instance = validator;
        const recorder = TrajectoryRecorder.getInstance(workspaceRoot);
        (recorder as any).getTrajectories = () => [{ taskId: 'test-acc', task: 'mock', skill: 'react', skillVersion: 1, toolCalls: [], success: false }];
        const service = SkillOptService.getInstance(workspaceRoot);
        
        (service as any).generator = { generateCandidate: async () => ({ candidates: [{ edits: [{ operation: 'add' }], content: 'mock' }] }) };
        (service as any).reflection = { reflect: async () => ({ improvements: ['test'] }) };
        (service as any).registry.createSkillVersion = () => ({ metadata: { version: 2 }, content: 'mock' });
        (service as any).registry.saveSkillVersion = () => {};
        (service as any).registry.promoteSkill = () => {};
        (service as any).validationGate = { evaluateDecision: () => ({ decision: 'accepted', reason: 'Improved', improvement: 1 }) };
        
        const result = await service.optimize('react', async () => 1);
        
        assert.strictEqual(result.candidate.status, 'CANDIDATE_ACCEPTED');
        assert.strictEqual(result.optimization.decision, 'ACCEPTED');
    });

    test('Candidate rejected -> REJECTED', async () => {
        const validator = new MockApplicabilityValidator({ applicable: 'YES', reasonCode: 'TASK_VALID', reason: 'Valid', evidence: [] });
        (TaskApplicabilityValidator as any).instance = validator;
        const recorder = TrajectoryRecorder.getInstance(workspaceRoot);
        (recorder as any).getTrajectories = () => [{ taskId: 'test-rej', task: 'mock', skill: 'react', skillVersion: 1, toolCalls: [], success: false }];
        const service = SkillOptService.getInstance(workspaceRoot);
        
        (service as any).generator = { generateCandidate: async () => ({ candidates: [{ edits: [{ operation: 'add' }], content: 'mock' }] }) };
        (service as any).reflection = { reflect: async () => ({ improvements: ['test'] }) };
        (service as any).registry.createSkillVersion = () => ({ metadata: { version: 2 }, content: 'mock' });
        (service as any).registry.saveSkillVersion = () => {};
        (service as any).validationGate = { evaluateDecision: () => ({ decision: 'rejected', reason: 'Worse', improvement: -1 }) };
        
        const result = await service.optimize('react', async () => -1);
        
        assert.strictEqual(result.candidate.status, 'CANDIDATE_REJECTED');
        assert.strictEqual(result.optimization.decision, 'REJECTED');
    });

});
