with open("src/services/llmEngine.ts", "r") as f:
    code = f.read()

code = code.replace("evaluator.evaluate(trajectory, { customWorkspace })", "evaluator.evaluate(trajectory, { ...(customWorkspace ? { customWorkspace } : {}) })")

with open("src/services/llmEngine.ts", "w") as f:
    f.write(code)

with open("src/services/skillOpt/evaluator.test.ts", "r") as f:
    code = f.read()
code = code.replace(", false", "")
code = code.replace(", true", "")
with open("src/services/skillOpt/evaluator.test.ts", "w") as f:
    f.write(code)

with open("src/services/skillOpt/skillOptService.ts", "r") as f:
    code = f.read()
code = code.replace(", true", "")
with open("src/services/skillOpt/skillOptService.ts", "w") as f:
    f.write(code)
    
