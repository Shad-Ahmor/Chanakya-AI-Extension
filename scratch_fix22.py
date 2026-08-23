with open("src/services/skillOpt/evaluator.ts", "r") as f:
    code = f.read()
code = code.replace("public async evaluate(trajectory", "public override async evaluate(trajectory")
with open("src/services/skillOpt/evaluator.ts", "w") as f:
    f.write(code)
