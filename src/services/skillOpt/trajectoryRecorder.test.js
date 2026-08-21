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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var trajectoryRecorder_1 = require("./trajectoryRecorder");
var path = __importStar(require("path"));
var fs = __importStar(require("fs"));
var assert = __importStar(require("assert"));
function runTests() {
    return __awaiter(this, void 0, void 0, function () {
        var testWorkspace, recorder, savedSuccess, savedFailed, fileExists, t3;
        return __generator(this, function (_a) {
            console.log("Starting Phase 3 Unit Tests...");
            testWorkspace = path.join(__dirname, 'test_workspace_phase3');
            if (fs.existsSync(testWorkspace)) {
                fs.rmSync(testWorkspace, { recursive: true, force: true });
            }
            trajectoryRecorder_1.TrajectoryRecorder.resetInstance();
            recorder = trajectoryRecorder_1.TrajectoryRecorder.getInstance(testWorkspace);
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
                savedSuccess = recorder.getTrajectory('task-1');
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
                savedFailed = recorder.getTrajectory('task-2');
                assert.ok(savedFailed);
                assert.strictEqual(savedFailed.success, false);
                console.log("Test 5 passed.");
                // 6. persistence and retrieval
                console.log("Running Test 6: persistence and retrieval");
                fileExists = fs.existsSync(path.join(testWorkspace, '.agents', 'trajectories', 'task-1.json'));
                assert.ok(fileExists);
                // Test secret redaction
                console.log("Testing secret redaction");
                recorder.startTask('task-3', 'login');
                recorder.recordToolCall('task-3', 'login_api', { token: 'super-secret' }, 'Bearer token=1234');
                recorder.endTask('task-3', true);
                t3 = recorder.getTrajectory('task-3');
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
            return [2 /*return*/];
        });
    });
}
runTests();
