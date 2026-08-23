import re

with open("src/services/skillOpt/skillOptService.test.ts", "r") as f:
    code = f.read()

code = code.replace("const result = await skillOptService.optimizeSkill('test_skill');", "const result = await skillOptService.optimize('test_skill', async () => 1.0);")
# Wait, let me check the original tests exactly to be safe
