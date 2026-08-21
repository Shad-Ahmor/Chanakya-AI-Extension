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
const evaluator_1 = require("./evaluator");
const assert = __importStar(require("assert"));
function createMockTrajectory(overrides) {
    return {
        taskId: 'mock-123',
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
    console.log("Starting Phase 4 Unit Tests...");
    const evaluator = evaluator_1.EvaluatorFactory.getEvaluator();
    try {
        // 1. successful trajectory
        console.log("Running Test 1: successful trajectory");
        const t1 = createMockTrajectory({
            success: true,
            toolCalls: [
                { toolName: 'search', args: {}, success: true },
                { toolName: 'run', args: {}, success: true }
            ]
        });
        const r1 = evaluator.evaluate(t1);
        assert.strictEqual(r1.success, true);
        assert.strictEqual(r1.score, 1.0);
        console.log("Test 1 passed.");
        // 2. failed trajectory
        console.log("Running Test 2: failed trajectory");
        const t2 = createMockTrajectory({
            success: false,
            toolCalls: []
        });
        const r2 = evaluator.evaluate(t2);
        assert.strictEqual(r2.success, false);
        assert.strictEqual(r2.score, 0.0);
        console.log("Test 2 passed.");
        // 3. MCP failure
        console.log("Running Test 3: MCP failure");
        const t3 = createMockTrajectory({
            success: true,
            toolCalls: [
                { toolName: 'search', args: {}, success: true },
                { toolName: 'run', args: {}, success: false, error: 'not found' }
            ]
        });
        const r3 = evaluator.evaluate(t3);
        assert.strictEqual(r3.success, true); // Still true because 0.7 score (50 + (25-5) = 70/100)
        assert.strictEqual(r3.score, 0.70);
        assert.ok(r3.reason.includes('MCP tool call(s) failed'));
        console.log("Test 3 passed.");
        // 4. retry-heavy trajectory
        console.log("Running Test 4: retry-heavy trajectory");
        const t4 = createMockTrajectory({
            success: true,
            retries: 3,
            toolCalls: [
                { toolName: 'search', args: {}, success: true }
            ]
        });
        const r4 = evaluator.evaluate(t4);
        assert.strictEqual(r4.success, true); // 50 + (50 - 30) = 70/100
        assert.strictEqual(r4.score, 0.70);
        assert.ok(r4.reason.includes('Required 3 retries'));
        console.log("Test 4 passed.");
        // 5. score calculation (extreme failures)
        console.log("Running Test 5: extreme failures");
        const t5 = createMockTrajectory({
            success: false,
            retries: 5,
            toolCalls: [
                { toolName: 'search', args: {}, success: false },
                { toolName: 'search', args: {}, success: false }
            ]
        });
        const r5 = evaluator.evaluate(t5);
        assert.strictEqual(r5.success, false);
        assert.strictEqual(r5.score, 0.0); // should not drop below 0
        console.log("Test 5 passed.");
        console.log("All Phase 4 unit tests passed successfully!");
    }
    catch (e) {
        console.error("Test failed:", e);
        process.exit(1);
    }
}
runTests();
//# sourceMappingURL=evaluator.test.js.map