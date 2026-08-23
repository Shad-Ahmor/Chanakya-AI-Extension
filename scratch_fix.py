import re

# 1. Fix Evaluator calls in tests and autoTrainer
files_to_fix = [
    "src/services/skillOpt/autoTrainer.ts",
    "src/services/skillOpt/evaluator.test.ts",
    "src/services/skillOpt/skillOptService.ts"
]

for file in files_to_fix:
    with open(file, "r") as f:
        code = f.read()
    code = code.replace("evaluator.evaluate(trajectory, true)", "evaluator.evaluate(trajectory)")
    code = code.replace("evaluator.evaluate(trajectory, false)", "evaluator.evaluate(trajectory)")
    code = code.replace("evaluator.evaluate(t, true)", "evaluator.evaluate(t)")
    code = code.replace("evaluator.evaluate(t, false)", "evaluator.evaluate(t)")
    with open(file, "w") as f:
        f.write(code)

# 2. Fix evaluator.ts unused vars
with open("src/services/skillOpt/evaluator.ts", "r") as f:
    code = f.read()
# Revert BaseTrajectoryEvaluator since it was incomplete anyway? No, just use them.
# The `evaluate` method in BaseTrajectoryEvaluator currently does:
#        // 2. Real build/test evaluation
#        const workspaceRoot = await this.getWorkspaceRoot(options);
#        let score = 0;
# And doesn't use `workspaceRoot`, `finalScore`, `success`.
# BaseTrajectoryEvaluator doesn't actually run detectStackAndTest in the original code, only DeterministicEvaluator does!
# Wait, BaseTrajectoryEvaluator is a stub for an LLM-based evaluator.
# Let's just remove the unused variables in BaseTrajectoryEvaluator.
code = re.sub(r'let finalScore = baseScore - toolPenalty;\n\s*let success = trajectory.success;', '', code)
code = code.replace("const workspaceRoot = await this.getWorkspaceRoot(options);", "")
with open("src/services/skillOpt/evaluator.ts", "w") as f:
    f.write(code)

# 3. Fix llmEngine.ts
with open("src/services/llmEngine.ts", "r") as f:
    code = f.read()

code = code.replace("{ customWorkspace }", "{ customWorkspace: customWorkspace || undefined }")

# In llmEngine, I did a replace of "workspaceRoot: vscode.workspace.workspaceFolders?.[0].uri.fsPath || '',"
# But it seems it hit multiple places where customWorkspace was NOT in scope!
# `streamChat` has these variables in scope, but maybe `streamChat` is not the only place with `workspaceRoot`.
# Wait, `customWorkspace`, `skillName`, `skillVersion` are missing at lines 358, 363, 364, 590, 732, 737, 738, 871.
# Oh! `streamChat` might not be the only method. There's `streamChat` and maybe `chat` or other methods?
