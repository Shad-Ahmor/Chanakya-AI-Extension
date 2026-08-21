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
var validationGate_1 = require("./validationGate");
var assert = __importStar(require("assert"));
function runTests() {
    console.log("Starting Phase 7 Unit Tests (ValidationGate)...");
    var gate = validationGate_1.ValidationGate.getInstance();
    try {
        console.log("Running Test 1: candidate improves (accepted)");
        var r1 = gate.evaluateDecision(0.70, 0.84, 0.02);
        assert.strictEqual(r1.decision, 'accepted');
        assert.strictEqual(r1.improvement, 0.14);
        console.log("Test 1 passed.");
        console.log("Running Test 2: candidate regresses (rejected)");
        var r2 = gate.evaluateDecision(0.70, 0.68, 0.02);
        assert.strictEqual(r2.decision, 'rejected');
        assert.strictEqual(r2.improvement, -0.02);
        console.log("Test 2 passed.");
        console.log("Running Test 3: candidate improvement too small (rejected)");
        var r3 = gate.evaluateDecision(0.70, 0.71, 0.02);
        assert.strictEqual(r3.decision, 'rejected');
        assert.strictEqual(r3.improvement, 0.01);
        console.log("Test 3 passed.");
        console.log("Running Test 4: candidate accepted edge case (meets exact threshold)");
        var r4 = gate.evaluateDecision(0.70, 0.72, 0.02);
        assert.strictEqual(r4.decision, 'accepted');
        assert.strictEqual(r4.improvement, 0.02);
        console.log("Test 4 passed.");
        console.log("Running Test 5: candidate rejected edge case (exactly zero improvement)");
        var r5 = gate.evaluateDecision(0.70, 0.70, 0.02);
        assert.strictEqual(r5.decision, 'rejected');
        assert.strictEqual(r5.improvement, 0.00);
        console.log("Test 5 passed.");
        console.log("All Phase 7 unit tests passed successfully!");
    }
    catch (e) {
        console.error("Test failed:", e);
        process.exit(1);
    }
}
runTests();
