with open("src/services/skillOpt/skillOptService.ts", "r") as f:
    code = f.read()
code = code.replace("await evaluator.evaluate(t).score", "(await evaluator.evaluate(t)).score")

# Fix tests
with open("src/services/skillOpt/skillOptService.test.ts", "r") as f:
    code = f.read()
# "error TS7053: Element implicitly has an 'any' type because expression of type '0' can't be used to index type 'OptimizationResult'."
# This means I accidentally replaced result[0] with result in test file earlier! Let's revert that.
code = code.replace("const result = await skillOptService.optimizeSkill('test_skill');\n        assert.strictEqual(result.skillName, 'test_skill');", "const results = await skillOptService.optimizeSkill('test_skill');\n        const result = results[0];\n        assert.strictEqual(result.skillName, 'test_skill');")
with open("src/services/skillOpt/skillOptService.test.ts", "w") as f:
    f.write(code)

with open("src/commands/runReactPilot.ts", "r") as f:
    code = f.read()
# "src/commands/runReactPilot.ts(41,29): error TS2554: Expected 2 arguments, but got 1."
# Wait, runReactPilot has missing argument for something? Let's check.
