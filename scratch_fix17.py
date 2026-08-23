import re

# Fix runReactPilot
with open("src/commands/runReactPilot.ts", "r") as f:
    code = f.read()
code = code.replace("async (cand, ref, traj, base)", "async (_c, _r, _t, base)")
with open("src/commands/runReactPilot.ts", "w") as f:
    f.write(code)

# Fix sidebarProvider
with open("src/providers/sidebarProvider.ts", "r") as f:
    code = f.read()
code = code.replace("async (c, r, t, b)", "async (_c, _r, _t, b)")
code = re.sub(r'skillOpt\.on\(.*?progressListener\);', '', code)
code = re.sub(r'skillOpt\.off\(.*?progressListener\);', '', code)
with open("src/providers/sidebarProvider.ts", "w") as f:
    f.write(code)

# Fix skillOptService.test.ts
with open("src/services/skillOpt/skillOptService.test.ts", "r") as f:
    code = f.read()
code = code.replace("const results = await skillOptService.optimizeSkill('test_skill');", "const results = await skillOptService.optimize('test_skill', async () => 1.0);")
with open("src/services/skillOpt/skillOptService.test.ts", "w") as f:
    f.write(code)

# Fix skillOptService.ts (107,88): Expected 2 arguments, but got 3.
# Let's check line 107
with open("src/services/skillOpt/skillOptService.ts", "r") as f:
    code = f.read()
code = code.replace("this.validationGate.evaluateDecision(scoreBefore, scoreAfter, 0.02);", "this.validationGate.evaluateDecision(scoreBefore, scoreAfter);")
with open("src/services/skillOpt/skillOptService.ts", "w") as f:
    f.write(code)

