with open("src/services/skillOpt/evaluator.ts", "r") as f:
    code = f.read()

code = code.replace("evaluate(trajectory: Trajectory): EvaluationResult;", "evaluate(trajectory: Trajectory, options?: { customWorkspace?: string }): Promise<EvaluationResult>;")
code = code.replace("public evaluate(trajectory: Trajectory): EvaluationResult {", "public async evaluate(trajectory: Trajectory, options?: { customWorkspace?: string }): Promise<EvaluationResult> {\n        const customWorkspace = options?.customWorkspace;\n")

with open("src/services/skillOpt/evaluator.ts", "w") as f:
    f.write(code)

with open("src/services/llmEngine.ts", "r") as f:
    code = f.read()

# Make sure we didn't miss options pass
code = code.replace("evaluator.evaluate(trajectory).then", "evaluator.evaluate(trajectory, { customWorkspace }).then")

with open("src/services/llmEngine.ts", "w") as f:
    f.write(code)
