"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mockModule = require('module');
const originalRequire = mockModule.prototype.require;
mockModule.prototype.require = function (request) {
    if (request === 'vscode') {
        return {
            workspace: { getConfiguration: () => ({ get: () => { } }) },
            CancellationTokenSource: class {
            },
            EventEmitter: class {
            }
        };
    }
    return originalRequire.apply(this, arguments);
};
const reflectionEngine_1 = require("./reflectionEngine");
const assert = __importStar(require("assert"));
// Mock AIService globally before testing
const mockAIService = {
    streamCompletion: (params) => {
        const prompt = params.prompt;
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
        }
        else {
            params.callbacks.onComplete(JSON.stringify({ observations: [], improvements: [] }));
        }
    }
};
const aiServiceModule = require('../aiService');
aiServiceModule.AIService = {
    getInstance: () => mockAIService
};
function createMockTrajectory(overrides) {
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
    const engine = reflectionEngine_1.ReflectionEngine.getInstance();
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
    }
    catch (e) {
        console.error("Test failed:", e);
        process.exit(1);
    }
}
runTests();
//# sourceMappingURL=reflectionEngine.test.js.map