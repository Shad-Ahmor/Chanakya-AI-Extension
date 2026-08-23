import { ValidationGate } from './validationGate';
import * as assert from 'assert';

function runTests() {
    console.log("Starting Phase 7 Unit Tests (ValidationGate)...");
    const gate = ValidationGate.getInstance();

    try {
        console.log("Running Test 1: candidate improves (accepted)");
        const r1 = gate.evaluateDecision(0.70, 0.84);
        assert.strictEqual(r1.decision, 'accepted');
        assert.strictEqual(r1.improvement, 0.14);
        console.log("Test 1 passed.");

        console.log("Running Test 2: candidate regresses (rejected)");
        const r2 = gate.evaluateDecision(0.70, 0.68);
        assert.strictEqual(r2.decision, 'rejected');
        assert.strictEqual(r2.improvement, -0.02);
        console.log("Test 2 passed.");

        console.log("Running Test 3: candidate improvement zero (rejected)");
        const r3 = gate.evaluateDecision(0.70, 0.70);
        assert.strictEqual(r3.decision, 'rejected');
        assert.strictEqual(r3.improvement, 0.00);
        console.log("Test 3 passed.");

        console.log("Running Test 4: candidate small improvement (accepted)");
        const r4 = gate.evaluateDecision(0.70, 0.71);
        assert.strictEqual(r4.decision, 'accepted');
        assert.strictEqual(r4.improvement, 0.01);
        console.log("Test 4 passed.");

        console.log("All Phase 7 unit tests passed successfully!");
    } catch (e) {
        console.error("Test failed:", e);
        process.exit(1);
    }
}

runTests();
