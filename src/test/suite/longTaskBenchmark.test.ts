import * as assert from 'assert';
import { TaskComplexityDetector } from '../../services/longTask/TaskComplexityDetector';
import { TaskComplexity } from '../../services/longTask/types';
suite('Long Task Subsystem Benchmarks', () => {
    let mockConfig: any;

    setup(() => {
        mockConfig = {
            model: 'test-model',
            maxTokens: 8192,
            temperature: 0.2,
            autoContextExtraction: true,
            systemPrompt: 'test',
            chatHistorySize: 10,
            longTask: {
                enabled: true,
                thresholds: {
                    maxContextLinesForStandard: 200,
                    extremeTokenThreshold: 8000,
                    complexityScoreTrigger: 0.7
                },
                persistArtifacts: true
            }
        };
    });

    test('Should correctly classify short tasks', () => {
        const detector = new TaskComplexityDetector(mockConfig);
        const complexity = detector.detect('Fix the typo in README.md').classification;
        assert.strictEqual(complexity, TaskComplexity.SMALL);
    });

    test('Should correctly classify long tasks based on context size', () => {
        const detector = new TaskComplexityDetector(mockConfig);
        const prompt = 'Refactor the entire authentication flow across all 15 services. Implement OAuth2, JWT rotation, and user session revocation. Make sure to update the database schema and migrate existing users.';
        const complexity = detector.detect(prompt).classification;
        
        assert.ok(
            complexity === TaskComplexity.LARGE || complexity === TaskComplexity.VERY_LARGE || complexity === TaskComplexity.EXTREME,
            `Expected LARGE or VERY_LARGE or EXTREME, got ${complexity}`
        );
    });
});
