with open("src/services/skillOpt/evaluator.test.ts", "r") as f:
    code = f.read()
code = code.replace("evaluator.evaluate(t1, false)", "await evaluator.evaluate(t1)")
code = code.replace("evaluator.evaluate(t2, false)", "await evaluator.evaluate(t2)")
code = code.replace("evaluator.evaluate(t3, false)", "await evaluator.evaluate(t3)")
code = code.replace("evaluator.evaluate(t4, false)", "await evaluator.evaluate(t4)")
code = code.replace("evaluator.evaluate(t5, false)", "await evaluator.evaluate(t5)")

code = code.replace("() => {", "async () => {")

with open("src/services/skillOpt/evaluator.test.ts", "w") as f:
    f.write(code)

with open("src/services/skillOpt/evaluator.ts", "r") as f:
    code = f.read()
code = code.replace("const customWorkspace = options?.customWorkspace;", "")
with open("src/services/skillOpt/evaluator.ts", "w") as f:
    f.write(code)

