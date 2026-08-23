import re

with open("src/providers/sidebarProvider.ts", "r") as f:
    code = f.read()
code = re.sub(r'const progressListener =.*?};\n', '', code, flags=re.DOTALL)
with open("src/providers/sidebarProvider.ts", "w") as f:
    f.write(code)

with open("src/services/skillOpt/skillOptService.test.ts", "r") as f:
    code = f.read()
code = code.replace("const result = results[0];", "const result = results;")
code = code.replace("await skillOptService.optimize('test_skill', async () => 1.0);", "await skillOptService.optimize('test_skill', async () => 1.0);")

with open("src/services/skillOpt/skillOptService.test.ts", "w") as f:
    f.write(code)

