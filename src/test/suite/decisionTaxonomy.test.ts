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

});
