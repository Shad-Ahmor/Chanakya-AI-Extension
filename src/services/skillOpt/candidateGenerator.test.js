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
var candidateGenerator_1 = require("./candidateGenerator");
var assert = __importStar(require("assert"));
var mockAIService = {
    streamCompletion: function (params) {
        var prompt = params.prompt;
        var fakeResponse = [];
        if (prompt.includes('missing parameters')) {
            fakeResponse = [
                {
                    operation: 'ADD',
                    section: '# MCP Usage',
                    content: '- Validate required MCP parameters before calling the tool.'
                }
            ];
        }
        else if (prompt.includes('remove bad rule')) {
            fakeResponse = [
                {
                    operation: 'DELETE',
                    targetContent: 'Always guess passwords.'
                }
            ];
        }
        else if (prompt.includes('replace logic')) {
            fakeResponse = [
                {
                    operation: 'REPLACE',
                    targetContent: 'Use 10 retries.',
                    content: 'Use 3 retries max.'
                }
            ];
        }
        params.callbacks.onComplete(JSON.stringify(fakeResponse));
    }
};
var aiServiceModule = require('../aiService');
aiServiceModule.AIService = {
    getInstance: function () { return mockAIService; }
};
function runTests() {
    return __awaiter(this, void 0, void 0, function () {
        var generator, currentSkill1, reflection1, r1, currentSkill2, reflection2, r2, currentSkill3, reflection3, r3, currentSkill4, reflection4, r4, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("Starting Phase 6 Unit Tests (CandidateGenerator)...");
                    generator = candidateGenerator_1.CandidateGenerator.getInstance();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    console.log("Running Test 1: ADD operation");
                    currentSkill1 = "# MCP Usage\n- Always be polite.";
                    reflection1 = {
                        observations: [],
                        improvements: [{ instruction: "Validate missing parameters." }]
                    };
                    return [4 /*yield*/, generator.generateCandidate(currentSkill1, reflection1)];
                case 2:
                    r1 = _a.sent();
                    assert.strictEqual(r1.edits.length, 1);
                    assert.strictEqual(r1.edits[0].operation, 'ADD');
                    assert.ok(r1.candidateContent.includes('Validate required MCP parameters'));
                    console.log("Test 1 passed.");
                    console.log("Running Test 2: DELETE operation");
                    currentSkill2 = "# Rules\nAlways guess passwords.\nBe secure.";
                    reflection2 = {
                        observations: [],
                        improvements: [{ instruction: "remove bad rule" }]
                    };
                    return [4 /*yield*/, generator.generateCandidate(currentSkill2, reflection2)];
                case 3:
                    r2 = _a.sent();
                    assert.strictEqual(r2.edits[0].operation, 'DELETE');
                    assert.ok(!r2.candidateContent.includes('Always guess passwords.'));
                    console.log("Test 2 passed.");
                    console.log("Running Test 3: REPLACE operation");
                    currentSkill3 = "Use 10 retries.";
                    reflection3 = {
                        observations: [],
                        improvements: [{ instruction: "replace logic" }]
                    };
                    return [4 /*yield*/, generator.generateCandidate(currentSkill3, reflection3)];
                case 4:
                    r3 = _a.sent();
                    assert.strictEqual(r3.edits[0].operation, 'REPLACE');
                    assert.ok(r3.candidateContent.includes('Use 3 retries max.'));
                    assert.ok(!r3.candidateContent.includes('Use 10 retries.'));
                    console.log("Test 3 passed.");
                    console.log("Running Test 4: Empty reflection improvements");
                    currentSkill4 = "Perfect skill.";
                    reflection4 = { observations: [], improvements: [] };
                    return [4 /*yield*/, generator.generateCandidate(currentSkill4, reflection4)];
                case 5:
                    r4 = _a.sent();
                    assert.strictEqual(r4.edits.length, 0);
                    assert.strictEqual(r4.candidateContent, "Perfect skill.");
                    console.log("Test 4 passed.");
                    console.log("All Phase 6 unit tests passed successfully!");
                    return [3 /*break*/, 7];
                case 6:
                    e_1 = _a.sent();
                    console.error("Test failed:", e_1);
                    process.exit(1);
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    });
}
runTests();
