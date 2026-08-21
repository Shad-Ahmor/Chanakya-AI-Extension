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
            window: { createOutputChannel: () => ({ appendLine: () => { } }) },
            CancellationTokenSource: class {
            },
            EventEmitter: class {
            }
        };
    }
    return originalRequire.apply(this, arguments);
};
const candidateGenerator_1 = require("./candidateGenerator");
const assert = __importStar(require("assert"));
const mockAIService = {
    streamCompletion: (params) => {
        const prompt = params.prompt;
        let fakeResponse = [];
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
const aiServiceModule = require('../aiService');
aiServiceModule.AIService = {
    getInstance: () => mockAIService
};
async function runTests() {
    console.log("Starting Phase 6 Unit Tests (CandidateGenerator)...");
    const generator = candidateGenerator_1.CandidateGenerator.getInstance();
    try {
        console.log("Running Test 1: ADD operation");
        const currentSkill1 = "# MCP Usage\n- Always be polite.";
        const reflection1 = {
            observations: [],
            improvements: [{ instruction: "Validate missing parameters." }]
        };
        const r1 = await generator.generateCandidate(currentSkill1, reflection1);
        assert.strictEqual(r1.edits.length, 1);
        assert.strictEqual(r1.edits[0].operation, 'ADD');
        assert.ok(r1.candidateContent.includes('Validate required MCP parameters'));
        console.log("Test 1 passed.");
        console.log("Running Test 2: DELETE operation");
        const currentSkill2 = "# Rules\nAlways guess passwords.\nBe secure.";
        const reflection2 = {
            observations: [],
            improvements: [{ instruction: "remove bad rule" }]
        };
        const r2 = await generator.generateCandidate(currentSkill2, reflection2);
        assert.strictEqual(r2.edits[0].operation, 'DELETE');
        assert.ok(!r2.candidateContent.includes('Always guess passwords.'));
        console.log("Test 2 passed.");
        console.log("Running Test 3: REPLACE operation");
        const currentSkill3 = "Use 10 retries.";
        const reflection3 = {
            observations: [],
            improvements: [{ instruction: "replace logic" }]
        };
        const r3 = await generator.generateCandidate(currentSkill3, reflection3);
        assert.strictEqual(r3.edits[0].operation, 'REPLACE');
        assert.ok(r3.candidateContent.includes('Use 3 retries max.'));
        assert.ok(!r3.candidateContent.includes('Use 10 retries.'));
        console.log("Test 3 passed.");
        console.log("Running Test 4: Empty reflection improvements");
        const currentSkill4 = "Perfect skill.";
        const reflection4 = { observations: [], improvements: [] };
        const r4 = await generator.generateCandidate(currentSkill4, reflection4);
        assert.strictEqual(r4.edits.length, 0);
        assert.strictEqual(r4.candidateContent, "Perfect skill.");
        console.log("Test 4 passed.");
        console.log("All Phase 6 unit tests passed successfully!");
    }
    catch (e) {
        console.error("Test failed:", e);
        process.exit(1);
    }
}
runTests();
//# sourceMappingURL=candidateGenerator.test.js.map