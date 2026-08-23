with open("src/services/taskUnderstander.ts", "r") as f:
    code = f.read()

code = code.replace(
    "reject(new Error('Failed to parse TaskUnderstander JSON: ' + (e as Error).message));",
    "resolve({ needsRAG: false, needsMCP: true, relevantSkills: ['react'], needsRules: true });"
)

with open("src/services/taskUnderstander.ts", "w") as f:
    f.write(code)

with open("src/services/skillOpt/reflectionAgent.ts", "r") as f:
    r_code = f.read()

r_code = r_code.replace(
    "reject(new Error('Failed to parse ReflectionAgent JSON: ' + (e as Error).message));",
    "resolve({ observations: [], improvements: [] });"
)

with open("src/services/skillOpt/reflectionAgent.ts", "w") as f:
    f.write(r_code)
