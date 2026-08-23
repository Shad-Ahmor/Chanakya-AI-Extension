import os
import glob

# Files that need evaluate to be awaited
files_to_fix = [
    "src/services/skillOpt/evaluator.test.ts",
    "src/services/skillOpt/skillOptService.test.ts",
    "src/services/skillOpt/skillOptService.ts",
    "src/services/skillOpt/reflectionEngine.test.ts",
    "src/services/skillOpt/reflectionEngine.ts",
    "src/commands/runReactPilot.ts",
    "src/providers/sidebarProvider.ts"
]

for root, dirs, files in os.walk("src"):
    for file in files:
        if file.endswith(".ts") or file.endswith(".tsx"):
            path = os.path.join(root, file)
            with open(path, "r") as f:
                code = f.read()
            
            # Simple heuristic to add await if missing
            if "evaluator.evaluate(" in code and "await evaluator.evaluate(" not in code:
                code = code.replace("evaluator.evaluate(", "await evaluator.evaluate(")
            
            with open(path, "w") as f:
                f.write(code)

print("Done")
