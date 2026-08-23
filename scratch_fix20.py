with open("src/services/skillOpt/evaluator.ts", "r") as f:
    code = f.read()
code = code.replace("options?: any", "_options?: any")
with open("src/services/skillOpt/evaluator.ts", "w") as f:
    f.write(code)
