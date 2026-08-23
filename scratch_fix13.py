with open("src/services/llmEngine.ts", "r") as f:
    code = f.read()
code = code.replace("await evaluator.evaluate(trajectory, { ...(customWorkspace ? { customWorkspace } : {}) }).then", "evaluator.evaluate(trajectory, { ...(customWorkspace ? { customWorkspace } : {}) }).then")
with open("src/services/llmEngine.ts", "w") as f:
    f.write(code)

with open("src/services/skillOpt/autoTrainer.ts", "r") as f:
    code = f.read()
code = code.replace("await evaluator.evaluate(trajectory)", "evaluator.evaluate(trajectory)")
with open("src/services/skillOpt/autoTrainer.ts", "w") as f:
    f.write(code)

with open("src/providers/sidebarProvider.ts", "r") as f:
    code = f.read()
code = code.replace("await evaluator.evaluate", "evaluator.evaluate")
with open("src/providers/sidebarProvider.ts", "w") as f:
    f.write(code)
    
