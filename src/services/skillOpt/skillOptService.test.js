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
var mockModule = require('module');
var originalRequire = mockModule.prototype.require;
mockModule.prototype.require = function (request) {
    if (request === 'vscode') {
        return {
            workspace: { getConfiguration: function () { return ({ get: function () { } }); } },
            window: { createOutputChannel: function () { return ({ appendLine: function () { } }); } },
            CancellationTokenSource: /** @class */ (function () {
                function CancellationTokenSource() {
                }
                return CancellationTokenSource;
            }()),
            EventEmitter: /** @class */ (function () {
                function EventEmitter() {
                }
                return EventEmitter;
            }())
        };
    }
    return originalRequire.apply(this, arguments);
};
var skillOptService_1 = require("./skillOptService");
var skillRegistry_1 = require("./skillRegistry");
var trajectoryRecorder_1 = require("./trajectoryRecorder");
var assert = __importStar(require("assert"));
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
var mockAIService = {
    streamCompletion: function (params) {
        var prompt = params.prompt;
        if (prompt.includes('expert AI agent behavior analyst')) {
            // Mock ReflectionEngine
            var fakeResponse = {
                observations: [
                    { problem: "Missing parameters", evidenceCount: 3 }
                ],
                improvements: [
                    { instruction: "Validate parameters." }
                ]
            };
            params.callbacks.onComplete(JSON.stringify(fakeResponse));
        }
        else {
            // Mock CandidateGenerator
            var fakeResponse = [
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
var aiServiceModule = require('../aiService');
aiServiceModule.AIService = {
    getInstance: function () { return mockAIService; }
};
function runTests() {
    return __awaiter(this, void 0, void 0, function () {
        var testWorkspace, registry, initSkill, recorder, service, acceptedResult, bestSkillAfterAccept, rejectedResult, bestSkillAfterReject, e_1;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("Starting Phase 9 Unit Tests (SkillOptService E2E)...");
                    testWorkspace = path.join(__dirname, 'test_workspace_phase9');
                    if (fs.existsSync(testWorkspace)) {
                        fs.rmSync(testWorkspace, { recursive: true, force: true });
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, 5, 6]);
                    skillOptService_1.SkillOptService.resetInstance();
                    registry = skillRegistry_1.SkillRegistry.getInstance(testWorkspace);
                    initSkill = registry.createSkillVersion('coding', '# Rules\nDo code.', 0, 'Initial');
                    registry.saveSkillVersion('coding', initSkill);
                    registry.promoteSkill('coding', initSkill.metadata.version);
                    recorder = trajectoryRecorder_1.TrajectoryRecorder.getInstance(testWorkspace);
                    // Create a fake trajectory
                    recorder.startTask('mock-task-1', 'Do something', 'coding', 1);
                    recorder.recordToolCall('mock-task-1', 'search', {}, undefined, 'error param');
                    recorder.endTask('mock-task-1', true);
                    service = skillOptService_1.SkillOptService.getInstance(testWorkspace);
                    // Test 1: Acceptance Loop
                    console.log("Running Test 1: Full Loop -> ACCEPT");
                    return [4 /*yield*/, service.optimize('coding', function (candidateContent) { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                // Mocking a successful validation run returning a much higher score
                                return [2 /*return*/, 0.95];
                            });
                        }); })];
                case 2:
                    acceptedResult = _a.sent();
                    assert.strictEqual(acceptedResult.decision, 'accepted');
                    assert.strictEqual(acceptedResult.skill, 'coding');
                    assert.strictEqual(acceptedResult.previousVersion, 1);
                    assert.strictEqual(acceptedResult.candidateVersion, 2);
                    assert.ok(acceptedResult.scoreBefore < 0.95);
                    assert.ok(acceptedResult.changes.length > 0);
                    bestSkillAfterAccept = registry.getBestSkill('coding');
                    assert.strictEqual(bestSkillAfterAccept === null || bestSkillAfterAccept === void 0 ? void 0 : bestSkillAfterAccept.metadata.version, 2);
                    console.log("Test 1 passed.");
                    // Create another fake trajectory for the new best version
                    recorder.startTask('mock-task-2', 'Do something else', 'coding', 2);
                    recorder.endTask('mock-task-2', true);
                    // Test 2: Rejection Loop
                    console.log("Running Test 2: Full Loop -> REJECT");
                    return [4 /*yield*/, service.optimize('coding', function (candidateContent) { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                // Mocking a failed validation run returning a worse score
                                return [2 /*return*/, 0.20];
                            });
                        }); })];
                case 3:
                    rejectedResult = _a.sent();
                    assert.strictEqual(rejectedResult.decision, 'rejected');
                    assert.strictEqual(rejectedResult.previousVersion, 2);
                    assert.strictEqual(rejectedResult.candidateVersion, 3);
                    assert.ok(rejectedResult.scoreAfter === 0.20);
                    bestSkillAfterReject = registry.getBestSkill('coding');
                    assert.strictEqual(bestSkillAfterReject === null || bestSkillAfterReject === void 0 ? void 0 : bestSkillAfterReject.metadata.version, 2);
                    console.log("Test 2 passed.");
                    console.log("All Phase 9 unit tests passed successfully!");
                    return [3 /*break*/, 6];
                case 4:
                    e_1 = _a.sent();
                    console.error("Test failed:", e_1);
                    process.exit(1);
                    return [3 /*break*/, 6];
                case 5:
                    if (fs.existsSync(testWorkspace)) {
                        fs.rmSync(testWorkspace, { recursive: true, force: true });
                    }
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    });
}
runTests();
