import re

with open("src/services/skillOpt/skillOptService.ts", "r") as f:
    code = f.read()

# Fix candidateResult usage
code = code.replace("candidateResult.edits", "candidateResult.candidates[0].edits")
code = code.replace("candidateResult.candidateContent", "candidateResult.candidates[0].content")

# Fix Generator signature
code = code.replace("await this.generator.generateCandidate(bestSkill.content, reflectionResult);", "await this.generator.generateCandidate(skillName, bestSkill.metadata.version, bestSkill.content, reflectionResult, []);")

# Fix evaluator evaluate args missing await
code = code.replace("const result = await evaluator.evaluate(trajectory);", "const result = await evaluator.evaluate(trajectory);")

with open("src/services/skillOpt/skillOptService.ts", "w") as f:
    f.write(code)


with open("src/providers/sidebarProvider.ts", "r") as f:
    code = f.read()

# Remove on/off usage on SkillOptService if any
code = re.sub(r'this\.skillOptService\.on\(.*?\);', '', code)
code = re.sub(r'this\.skillOptService\.off\(.*?\);', '', code)

with open("src/providers/sidebarProvider.ts", "w") as f:
    f.write(code)

with open("src/commands/runReactPilot.ts", "r") as f:
    code = f.read()
# Fix Generator signature in runReactPilot.ts if it exists
code = code.replace("CandidateGenerator.getInstance()", "CandidateGenerator.getInstance('')")
with open("src/commands/runReactPilot.ts", "w") as f:
    f.write(code)

with open("src/services/skillOpt/skillOptService.test.ts", "r") as f:
    code = f.read()
# Fix candidateResult.edits in test
code = code.replace("result[0]", "result")
with open("src/services/skillOpt/skillOptService.test.ts", "w") as f:
    f.write(code)

