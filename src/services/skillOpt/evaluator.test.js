"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var evaluator_1 = require("./evaluator");
var assert = __importStar(require("assert"));
function createMockTrajectory(overrides) {
    return __assign({ taskId: 'mock-123', task: 'Do something', skill: 'coding', skillVersion: 1, toolCalls: [], retries: 0, success: true, durationMs: 1000, timestamp: Date.now() }, overrides);
}
function runTests() {
    return __awaiter(this, void 0, void 0, function () {
        var evaluator, t1, r1, t2, r2, t3, r3, t4, r4, t5, r5;
        return __generator(this, function (_a) {
            console.log("Starting Phase 4 Unit Tests...");
            evaluator = evaluator_1.EvaluatorFactory.getEvaluator();
            try {
                // 1. successful trajectory
                console.log("Running Test 1: successful trajectory");
                t1 = createMockTrajectory({
                    success: true,
                    toolCalls: [
                        { toolName: 'search', args: {}, success: true },
                        { toolName: 'run', args: {}, success: true }
                    ]
                });
                r1 = evaluator.evaluate(t1);
                assert.strictEqual(r1.success, true);
                assert.strictEqual(r1.score, 1.0);
                console.log("Test 1 passed.");
                // 2. failed trajectory
                console.log("Running Test 2: failed trajectory");
                t2 = createMockTrajectory({
                    success: false,
                    toolCalls: []
                });
                r2 = evaluator.evaluate(t2);
                assert.strictEqual(r2.success, false);
                assert.strictEqual(r2.score, 0.0);
                console.log("Test 2 passed.");
                // 3. MCP failure
                console.log("Running Test 3: MCP failure");
                t3 = createMockTrajectory({
                    success: true,
                    toolCalls: [
                        { toolName: 'search', args: {}, success: true },
                        { toolName: 'run', args: {}, success: false, error: 'not found' }
                    ]
                });
                r3 = evaluator.evaluate(t3);
                assert.strictEqual(r3.success, true); // Still true because 0.7 score (50 + (25-5) = 70/100)
                assert.strictEqual(r3.score, 0.70);
                assert.ok(r3.reason.includes('MCP tool call(s) failed'));
                console.log("Test 3 passed.");
                // 4. retry-heavy trajectory
                console.log("Running Test 4: retry-heavy trajectory");
                t4 = createMockTrajectory({
                    success: true,
                    retries: 3,
                    toolCalls: [
                        { toolName: 'search', args: {}, success: true }
                    ]
                });
                r4 = evaluator.evaluate(t4);
                assert.strictEqual(r4.success, true); // 50 + (50 - 30) = 70/100
                assert.strictEqual(r4.score, 0.70);
                assert.ok(r4.reason.includes('Required 3 retries'));
                console.log("Test 4 passed.");
                // 5. score calculation (extreme failures)
                console.log("Running Test 5: extreme failures");
                t5 = createMockTrajectory({
                    success: false,
                    retries: 5,
                    toolCalls: [
                        { toolName: 'search', args: {}, success: false },
                        { toolName: 'search', args: {}, success: false }
                    ]
                });
                r5 = evaluator.evaluate(t5);
                assert.strictEqual(r5.success, false);
                assert.strictEqual(r5.score, 0.0); // should not drop below 0
                console.log("Test 5 passed.");
                console.log("All Phase 4 unit tests passed successfully!");
            }
            catch (e) {
                console.error("Test failed:", e);
                process.exit(1);
            }
            return [2 /*return*/];
        });
    });
}
runTests();
