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
const trajectoryRecorder_1 = require("./trajectoryRecorder");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const assert = __importStar(require("assert"));
async function runTests() {
    console.log("Starting Phase 3 Unit Tests...");
    const testWorkspace = path.join(__dirname, 'test_workspace_phase3');
    if (fs.existsSync(testWorkspace)) {
        fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
    trajectoryRecorder_1.TrajectoryRecorder.resetInstance();
    const recorder = trajectoryRecorder_1.TrajectoryRecorder.getInstance(testWorkspace);
    try {
        // 1. trajectory creation
        console.log("Running Test 1: trajectory creation");
        recorder.startTask('task-1', 'write a function', 'coding', 2);
        console.log("Test 1 passed.");
        // 2. tool call recording
        console.log("Running Test 2: tool call recording");
        recorder.recordToolCall('task-1', 'search_code', { query: 'login' }, 'found 2 results');
        console.log("Test 2 passed.");
        // 3. error recording
        console.log("Running Test 3: error recording");
        recorder.recordToolCall('task-1', 'run_terminal_command', { command: 'npm run test' }, undefined, 'command not found');
        console.log("Test 3 passed.");
        // 4. successful task recording
        console.log("Running Test 4: successful task recording");
        recorder.endTask('task-1', true);
        const savedSuccess = recorder.getTrajectory('task-1');
        assert.ok(savedSuccess);
        assert.strictEqual(savedSuccess.success, true);
        assert.strictEqual(savedSuccess.toolCalls.length, 2);
        assert.strictEqual(savedSuccess.toolCalls[0].success, true);
        assert.strictEqual(savedSuccess.toolCalls[1].success, false);
        assert.strictEqual(savedSuccess.toolCalls[1].error, 'command not found');
        console.log("Test 4 passed.");
        // 5. failed task recording
        console.log("Running Test 5: failed task recording");
        recorder.startTask('task-2', 'break something', 'testing', 1);
        recorder.endTask('task-2', false);
        const savedFailed = recorder.getTrajectory('task-2');
        assert.ok(savedFailed);
        assert.strictEqual(savedFailed.success, false);
        console.log("Test 5 passed.");
        // 6. persistence and retrieval
        console.log("Running Test 6: persistence and retrieval");
        const fileExists = fs.existsSync(path.join(testWorkspace, '.agents', 'trajectories', 'task-1.json'));
        assert.ok(fileExists);
        // Test secret redaction
        console.log("Testing secret redaction");
        recorder.startTask('task-3', 'login');
        recorder.recordToolCall('task-3', 'login_api', { token: 'super-secret' }, 'Bearer token=1234');
        recorder.endTask('task-3', true);
        const t3 = recorder.getTrajectory('task-3');
        assert.strictEqual(t3.toolCalls[0].args.token, '[REDACTED]');
        assert.ok(t3.toolCalls[0].result.includes('[REDACTED]'));
        console.log("All Phase 3 unit tests passed successfully!");
    }
    catch (e) {
        console.error("Test failed:", e);
        process.exit(1);
    }
    finally {
        if (fs.existsSync(testWorkspace)) {
            fs.rmSync(testWorkspace, { recursive: true, force: true });
        }
    }
}
runTests();
//# sourceMappingURL=trajectoryRecorder.test.js.map