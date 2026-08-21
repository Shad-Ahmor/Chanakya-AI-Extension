import { ValidationGate } from './validationGate';
import * as assert from 'assert';

function runTests() {
    console.log("Starting Phase 7 Unit Tests (ValidationGate)...");
    const gate = ValidationGate.getInstance();

    try {
        console.log("Running Test 1: candidate improves (accepted)");
        const r1 = gate.evaluateDecision(0.70, 0.84, 0.02);
        assert.strictEqual(r1.decision, 'accepted');
        assert.strictEqual(r1.improvement, 0.14);
        console.log("Test 1 passed.");

        console.log("Running Test 2: candidate regresses (rejected)");
        const r2 = gate.evaluateDecision(0.70, 0.68, 0.02);
        assert.strictEqual(r2.decision, 'rejected');
        assert.strictEqual(r2.improvement, -0.02);
        console.log("Test 2 passed.");

        console.log("Running Test 3: candidate improvement too small (rejected)");
        const r3 = gate.evaluateDecision(0.70, 0.71, 0.02);
        assert.strictEqual(r3.decision, 'rejected');
        assert.strictEqual(r3.improvement, 0.01);
        console.log("Test 3 passed.");

        console.log("Running Test 4: candidate accepted edge case (meets exact threshold)");
        const r4 = gate.evaluateDecision(0.70, 0.72, 0.02);
        assert.strictEqual(r4.decision, 'accepted');
        assert.strictEqual(r4.improvement, 0.02);
        console.log("Test 4 passed.");

        console.log("Running Test 5: candidate rejected edge case (exactly zero improvement)");
        const r5 = gate.evaluateDecision(0.70, 0.70, 0.02);
        assert.strictEqual(r5.decision, 'rejected');
        assert.strictEqual(r5.improvement, 0.00);
        console.log("Test 5 passed.");

        console.log("All Phase 7 unit tests passed successfully!");
    } catch (e) {
        console.error("Test failed:", e);
        process.exit(1);
    }
}

runTests();
