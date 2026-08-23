with open("src/services/skillOpt/skillOptService.ts", "r") as f:
    code = f.read()
code = code.replace("evaluator.evaluate(trajectory, true)", "await evaluator.evaluate(trajectory)")
code = code.replace("evaluator.evaluate(t, true)", "await evaluator.evaluate(t)")
with open("src/services/skillOpt/skillOptService.ts", "w") as f:
    f.write(code)
