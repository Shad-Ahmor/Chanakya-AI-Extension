with open("src/services/skillOpt/evaluator.ts", "r") as f:
    code = f.read()
code = code.replace("public override async evaluate(trajectory", "public async evaluate(trajectory", 1)
with open("src/services/skillOpt/evaluator.ts", "w") as f:
    f.write(code)
